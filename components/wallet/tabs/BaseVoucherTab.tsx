"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Transaction, TransactionButton } from "@coinbase/onchainkit/transaction";
import { encodeContractCall } from "@/lib/utils/tx";
import { base } from "viem/chains";
import { useAccount, usePublicClient } from "wagmi";
import {
  Copy,
  CreditCard,
  RefreshCcw,
  CheckCircle,
  AlertCircle,
  Coins,
  Share2,
  Search,
  ChevronDown,
} from "lucide-react";
import {
  ERC20_ABI,
  USDC_BASE,
  VOUCHER_ABI,
} from "@/lib/constants/contracts";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";
import type { VoucherBatchMeta } from "@/lib/types/voucher";
import {
  MAX_VOUCHER_CARDS,
  type StoredVoucherBatch,
  type VoucherAsset,
  computeSplit,
  formatSplitSummary,
  formatVoucherAmount,
  formatCardShareText,
  formatBatchShareText,
  formatCardId,
  generateVoucherCards,
  hashVoucherSecret,
  loadLocalBatches,
  parseCardId,
  parseEthAmount,
  parseUsdcAmount,
  saveLocalBatch,
  tokenToAsset,
} from "@/lib/utils/voucher";
import { getCapabilities } from "@/lib/utils/paymaster";
import SectionCard from "@/components/ui/SectionCard";
import VoucherHero from "@/components/wallet/VoucherHero";
import VoucherGiftCard3D from "@/components/wallet/VoucherGiftCard3D";
import VoucherWhySection from "@/components/wallet/VoucherWhySection";
import VoucherCredentialCard from "@/components/wallet/VoucherCredentialCard";
import VoucherSecurityNotice from "@/components/wallet/VoucherSecurityNotice";
import VoucherRedeemReveal from "@/components/wallet/VoucherRedeemReveal";
import { APP_URL_WEB } from "@/lib/constants/env";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { txHashFromLifecycle } from "@/lib/utils/tx-status";
import type { LifecycleStatus } from "@coinbase/onchainkit/transaction";

type VoucherView = "create" | "redeem" | "view" | "mine";

interface ViewedCard {
  cardId: string;
  batchId: number;
  cardIndex: number;
  asset: VoucherAsset;
  amountPerCard: bigint;
  message: string;
  creator: string;
  cardCount: number;
  redeemedCount: number;
  redeemed: boolean;
  secretValid: boolean | null;
}

interface RedeemPreview {
  cardId: string;
  asset: VoucherAsset;
  amountPerCard: bigint;
  message: string;
  redeemed: boolean;
}

interface RedeemSuccess {
  cardId: string;
  asset: VoucherAsset;
  amountPerCard: bigint;
  message: string;
  txHash?: string;
}

function VoucherCardPreview({
  cardId,
  secret,
  asset,
  amount,
  message,
  redeemed,
  showSecret = true,
}: {
  cardId: string;
  secret?: string;
  asset: VoucherAsset;
  amount: bigint;
  message?: string;
  redeemed?: boolean;
  showSecret?: boolean;
}) {
  return (
    <div className="space-y-3">
      <VoucherGiftCard3D
        asset={asset}
        amount={amount}
        message={message}
        status={redeemed ? "redeemed" : "active"}
        compact
        showStack={false}
      />
      <div className="glass-panel-accent rounded-xl px-3 py-2.5 space-y-1">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
          Card ID · {cardId}
        </p>
        {showSecret && secret ? (
          <p className="font-mono text-xs text-white/90 tracking-wider break-all">{secret}</p>
        ) : (
          <p className="font-mono text-xs text-slate-500 tracking-wider">•••••-•••••-•••••-•••••</p>
        )}
      </div>
      {message && (
        <p className="text-sm text-slate-200 italic px-1 leading-relaxed">&quot;{message}&quot;</p>
      )}
    </div>
  );
}

export default function BaseVoucherTab({ app }: { app: WalletAppState }) {
  const { showToast, setSponsored } = app;
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  const txCaps = getCapabilities();
  const contractReady = Boolean(VOUCHER_CONTRACT);

  const [view, setView] = useState<VoucherView>("create");
  const [asset, setAsset] = useState<VoucherAsset>("USDC");
  const [totalAmount, setTotalAmount] = useState("10");
  const [cardCountInput, setCardCountInput] = useState("10");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingCards, setPendingCards] = useState<StoredVoucherBatch | null>(null);
  const [createdCards, setCreatedCards] = useState<StoredVoucherBatch | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null);
  const createdSectionRef = useRef<HTMLDivElement>(null);
  const pendingBatchRef = useRef<StoredVoucherBatch | null>(null);
  const notifiedTxRef = useRef("");
  const redeemNotifiedRef = useRef("");
  const redeemParsedRef = useRef<ReturnType<typeof parseCardId>>(null);
  const redeemPreviewRef = useRef<RedeemPreview | null>(null);
  const createHandledRef = useRef(false);

  const [redeemCardId, setRedeemCardId] = useState("");
  const [redeemSecret, setRedeemSecret] = useState("");
  const [redeemError, setRedeemError] = useState("");
  const [redeemKey, setRedeemKey] = useState(0);
  const [redeemPreview, setRedeemPreview] = useState<RedeemPreview | null>(null);
  const [redeemPreviewLoading, setRedeemPreviewLoading] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<RedeemSuccess | null>(null);

  const [myBatches, setMyBatches] = useState<StoredVoucherBatch[]>([]);
  const [chainStats, setChainStats] = useState<Record<number, number>>({});
  const [batchCardStatuses, setBatchCardStatuses] = useState<
    Record<number, Array<{ cardIndex: number; cardId: string; redeemed: boolean }>>
  >({});
  const [creatorSummary, setCreatorSummary] = useState<{
    batchCount: number;
    totalCards: number;
    totalUnredeemed: number;
  } | null>(null);
  const [loadingBatchDetail, setLoadingBatchDetail] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [viewCardId, setViewCardId] = useState("");
  const [viewSecret, setViewSecret] = useState("");
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");
  const [viewedCard, setViewedCard] = useState<ViewedCard | null>(null);

  const cardCount = useMemo(() => {
    const n = parseInt(cardCountInput, 10);
    return Number.isFinite(n) ? n : 0;
  }, [cardCountInput]);

  const split = useMemo(
    () => computeSplit(totalAmount, cardCount, asset),
    [totalAmount, cardCount, asset]
  );

  const perCardWei = split?.valid ? split.perCard : null;

  const refreshMyBatches = useCallback(async () => {
    if (!address) return;
    const local = loadLocalBatches(address);
    const merged = new Map(local.map((b) => [b.batchId, b]));
    const stats: Record<number, number> = {};

    try {
      const res = await fetch(
        `/api/vouchers?creator=${encodeURIComponent(address)}&live=1`
      );
      if (res.ok) {
        const summary = (await res.json()) as {
          batchCount: number;
          totalCards: number;
          totalUnredeemed: number;
          batches: Array<{
            batchId: number;
            asset: VoucherAsset;
            totalAmount: string;
            amountPerCard: string;
            cardCount: number;
            redeemedCount: number;
            unredeemedCount: number;
            message: string;
            creator: string;
            createdAt?: number;
            txHash?: string;
          }>;
        };

        setCreatorSummary({
          batchCount: summary.batchCount,
          totalCards: summary.totalCards,
          totalUnredeemed: summary.totalUnredeemed,
        });

        for (const b of summary.batches ?? []) {
          stats[b.batchId] = b.redeemedCount;
          if (!merged.has(b.batchId)) {
            merged.set(b.batchId, {
              batchId: b.batchId,
              asset: b.asset,
              totalAmount: b.totalAmount,
              amountPerCard: b.amountPerCard,
              cardCount: b.cardCount,
              message: b.message,
              creator: b.creator,
              createdAt: b.createdAt ?? Date.now(),
              txHash: b.txHash,
              cards: Array.from({ length: b.cardCount }, (_, i) => ({
                batchId: b.batchId,
                cardIndex: i,
                cardId: formatCardId(b.batchId, i),
                secret: "",
              })),
            });
          }
        }
        setChainStats(stats);
        setMyBatches([...merged.values()].sort((a, b) => b.batchId - a.batchId));
        return;
      }
    } catch {
      /* fall through to local + RPC */
    }

    setCreatorSummary(null);
    if (!publicClient || !contractReady) {
      setMyBatches(local);
      return;
    }

    for (const b of local) {
      try {
        const result = await publicClient.readContract({
          address: VOUCHER_CONTRACT as `0x${string}`,
          abi: VOUCHER_ABI,
          functionName: "getBatch",
          args: [BigInt(b.batchId)],
        });
        stats[b.batchId] = Number(result[4]);
      } catch {
        stats[b.batchId] = 0;
      }
    }
    setChainStats(stats);
    setMyBatches(local);
  }, [address, publicClient, contractReady]);

  const loadBatchDetail = useCallback(async (batchId: number) => {
    setLoadingBatchDetail(batchId);
    try {
      const res = await fetch(`/api/vouchers?batchId=${batchId}&live=1`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        batch?: { redeemedCount: number; unredeemedCount: number };
        cards?: Array<{ cardIndex: number; cardId: string; redeemed: boolean }>;
      };
      if (data.batch) {
        setChainStats((prev) => ({ ...prev, [batchId]: data.batch!.redeemedCount }));
      }
      if (data.cards) {
        setBatchCardStatuses((prev) => ({ ...prev, [batchId]: data.cards! }));
      }
    } finally {
      setLoadingBatchDetail((current) => (current === batchId ? null : current));
    }
  }, []);

  useEffect(() => {
    refreshMyBatches();
  }, [refreshMyBatches]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const shareText = async (text: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Base Voucher Gift Card", text, url: APP_URL_WEB });
        return;
      } catch {
        /* user cancelled or unsupported */
      }
    }
    copyText(text, id);
  };

  const lookupCard = async () => {
    const parsed = parseCardId(viewCardId);
    if (!parsed || !publicClient || !contractReady) {
      setViewError("Enter a valid Card ID (e.g. 12-3)");
      setViewedCard(null);
      return;
    }
    setViewLoading(true);
    setViewError("");
    setViewedCard(null);
    try {
      const [batch, redeemed] = await Promise.all([
        publicClient.readContract({
          address: VOUCHER_CONTRACT as `0x${string}`,
          abi: VOUCHER_ABI,
          functionName: "getBatch",
          args: [BigInt(parsed.batchId)],
        }),
        publicClient.readContract({
          address: VOUCHER_CONTRACT as `0x${string}`,
          abi: VOUCHER_ABI,
          functionName: "isCardRedeemed",
          args: [BigInt(parsed.batchId), BigInt(parsed.cardIndex)],
        }),
      ]);
      const [creator, token, amountPerCard, cardCount, redeemedCount, message] = batch;
      if (cardCount === BigInt(0)) {
        setViewError("Batch not found onchain.");
        return;
      }
      if (parsed.cardIndex >= Number(cardCount)) {
        setViewError(`This batch only has cards 0–${Number(cardCount) - 1}.`);
        return;
      }

      let secretValid: boolean | null = null;
      if (viewSecret.trim()) {
        const onChainHash = await publicClient.readContract({
          address: VOUCHER_CONTRACT as `0x${string}`,
          abi: VOUCHER_ABI,
          functionName: "cardSecretHashes",
          args: [BigInt(parsed.batchId), BigInt(parsed.cardIndex)],
        });
        secretValid = hashVoucherSecret(viewSecret) === onChainHash;
      }

      setViewedCard({
        cardId: viewCardId.trim(),
        batchId: parsed.batchId,
        cardIndex: parsed.cardIndex,
        asset: tokenToAsset(token),
        amountPerCard,
        message,
        creator,
        cardCount: Number(cardCount),
        redeemedCount: Number(redeemedCount),
        redeemed,
        secretValid,
      });
    } catch {
      setViewError("Could not load voucher. Check Card ID and try again.");
    } finally {
      setViewLoading(false);
    }
  };

  const prepareCreate = async () => {
    if (!address || !publicClient || !contractReady) return;
    setCreating(true);
    setCreatedCards(null);
    try {
      const total =
        asset === "ETH" ? parseEthAmount(totalAmount) : parseUsdcAmount(totalAmount);
      if (!total || !perCardWei) {
        alert("Enter a valid amount that splits evenly across all cards.");
        return;
      }
      if (cardCount < 1 || cardCount > MAX_VOUCHER_CARDS) {
        alert(`Card count must be 1–${MAX_VOUCHER_CARDS}.`);
        return;
      }

      const nextId = await publicClient.readContract({
        address: VOUCHER_CONTRACT as `0x${string}`,
        abi: VOUCHER_ABI,
        functionName: "nextBatchId",
      });
      const batchId = Number(nextId);
      const cards = generateVoucherCards(batchId, cardCount);
      const hashes = cards.map((c) => hashVoucherSecret(c.secret));

      const batch: StoredVoucherBatch = {
        batchId,
        asset,
        totalAmount: total.toString(),
        amountPerCard: perCardWei.toString(),
        cardCount,
        message: message.trim(),
        creator: address,
        createdAt: Date.now(),
        cards,
      };

      setPendingCards(batch);
      pendingBatchRef.current = batch;
      createHandledRef.current = false;
      notifiedTxRef.current = "";
      setPendingHashes(hashes);
      setPendingTotal(total);
    } catch (e) {
      console.error(e);
      alert("Could not prepare voucher batch. Check contract connection.");
    } finally {
      setCreating(false);
    }
  };

  const [pendingHashes, setPendingHashes] = useState<`0x${string}`[]>([]);
  const [pendingTotal, setPendingTotal] = useState<bigint>(BigInt(0));
  const [usdcAllowance, setUsdcAllowance] = useState<bigint | null>(null);
  const [checkingAllowance, setCheckingAllowance] = useState(false);

  const notifyVoucherTx = useCallback(
    (msg: string, hash?: string, dedupeRef: MutableRefObject<string> = notifiedTxRef) => {
      const h = hash?.trim() ?? "";
      const dedupeKey = h || msg;
      if (dedupeRef.current === dedupeKey) return;
      dedupeRef.current = dedupeKey;
      showToast(msg, h);
      if (h) setSponsored((v) => v + 1);
    },
    [showToast, setSponsored]
  );

  useEffect(() => {
    if (!address || !pendingCards || asset !== "USDC" || !publicClient) {
      setUsdcAllowance(null);
      return;
    }
    let cancelled = false;
    setCheckingAllowance(true);
    publicClient
      .readContract({
        address: USDC_BASE as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, VOUCHER_CONTRACT as `0x${string}`],
      })
      .then((value) => {
        if (!cancelled) setUsdcAllowance(value);
      })
      .catch(() => {
        if (!cancelled) setUsdcAllowance(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingAllowance(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, pendingCards, asset, publicClient, pendingTotal]);

  const createEthCall = useMemo(() => {
    if (!pendingCards || !contractReady || asset !== "ETH") return [];
    return [
      encodeContractCall(
        VOUCHER_CONTRACT as `0x${string}`,
        VOUCHER_ABI,
        "createEthBatch",
        [BigInt(cardCount), pendingHashes, message.trim()],
        pendingTotal
      ),
    ];
  }, [pendingCards, contractReady, asset, cardCount, pendingHashes, message, pendingTotal]);

  const approveUsdcCall = useMemo(() => {
    if (!pendingCards || !contractReady || asset !== "USDC") return [];
    return [
      encodeContractCall(USDC_BASE as `0x${string}`, ERC20_ABI, "approve", [
        VOUCHER_CONTRACT as `0x${string}`,
        pendingTotal,
      ]),
    ];
  }, [pendingCards, contractReady, asset, pendingTotal]);

  const createUsdcCall = useMemo(() => {
    if (!pendingCards || !contractReady || asset !== "USDC") return [];
    return [
      encodeContractCall(VOUCHER_CONTRACT as `0x${string}`, VOUCHER_ABI, "createUsdcBatch", [
        BigInt(cardCount),
        pendingHashes,
        message.trim(),
        pendingTotal,
      ]),
    ];
  }, [pendingCards, contractReady, asset, cardCount, pendingHashes, message, pendingTotal]);

  const needsUsdcApproval =
    usdcAllowance === null ? true : usdcAllowance < pendingTotal;

  const fundUsdcCalls = useMemo(() => {
    if (!pendingCards || !contractReady || asset !== "USDC") return [];
    if (!needsUsdcApproval) return createUsdcCall;
    return [...approveUsdcCall, ...createUsdcCall];
  }, [
    pendingCards,
    contractReady,
    asset,
    needsUsdcApproval,
    approveUsdcCall,
    createUsdcCall,
  ]);

  const redeemParsed = parseCardId(redeemCardId);
  redeemParsedRef.current = redeemParsed;

  useEffect(() => {
    redeemNotifiedRef.current = "";
  }, [redeemKey]);

  useEffect(() => {
    if (!redeemParsed || !publicClient || !contractReady) {
      setRedeemPreview(null);
      redeemPreviewRef.current = null;
      return;
    }
    let cancelled = false;
    setRedeemPreviewLoading(true);
    setRedeemError("");

    (async () => {
      try {
        const [batch, redeemed] = await Promise.all([
          publicClient.readContract({
            address: VOUCHER_CONTRACT as `0x${string}`,
            abi: VOUCHER_ABI,
            functionName: "getBatch",
            args: [BigInt(redeemParsed.batchId)],
          }),
          publicClient.readContract({
            address: VOUCHER_CONTRACT as `0x${string}`,
            abi: VOUCHER_ABI,
            functionName: "isCardRedeemed",
            args: [BigInt(redeemParsed.batchId), BigInt(redeemParsed.cardIndex)],
          }),
        ]);
        const [, token, amountPerCard, cardCount, , message] = batch;
        if (cancelled) return;
        if (cardCount === BigInt(0)) {
          setRedeemPreview(null);
          redeemPreviewRef.current = null;
          setRedeemError("Batch not found onchain.");
          return;
        }
        if (redeemParsed.cardIndex >= Number(cardCount)) {
          setRedeemPreview(null);
          redeemPreviewRef.current = null;
          setRedeemError(`This batch only has cards 0–${Number(cardCount) - 1}.`);
          return;
        }
        const preview: RedeemPreview = {
          cardId: formatCardId(redeemParsed.batchId, redeemParsed.cardIndex),
          asset: tokenToAsset(token),
          amountPerCard,
          message: String(message ?? ""),
          redeemed,
        };
        setRedeemPreview(preview);
        redeemPreviewRef.current = preview;
        if (redeemed) {
          setRedeemError("This card has already been redeemed.");
        }
      } catch {
        if (!cancelled) {
          setRedeemPreview(null);
          redeemPreviewRef.current = null;
        }
      } finally {
        if (!cancelled) setRedeemPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [redeemParsed, publicClient, contractReady, redeemKey]);
  const redeemCall = useMemo(() => {
    if (!redeemParsed || !redeemSecret.trim() || !contractReady) return [];
    return [
      encodeContractCall(VOUCHER_CONTRACT as `0x${string}`, VOUCHER_ABI, "redeem", [
        BigInt(redeemParsed.batchId),
        BigInt(redeemParsed.cardIndex),
        redeemSecret.trim().toUpperCase(),
      ]),
    ];
  }, [redeemParsed, redeemSecret, contractReady]);

  const onCreateSuccess = useCallback(
    async (txHash?: string) => {
      if (!address || createHandledRef.current) return;
      const batch = pendingCards ?? pendingBatchRef.current;
      if (!batch) return;
      createHandledRef.current = true;

      const saved = { ...batch, txHash };
      saveLocalBatch(address, saved);
      setCreatedCards(saved);
      setPendingCards(null);
      pendingBatchRef.current = null;
      setExpandedBatchId(saved.batchId);
      setView("create");

      await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: saved.batchId,
          creator: address,
          asset: saved.asset,
          totalAmount: saved.totalAmount,
          amountPerCard: saved.amountPerCard,
          cardCount: saved.cardCount,
          message: saved.message,
          redeemedCount: 0,
          createdAt: saved.createdAt,
          txHash,
        } satisfies VoucherBatchMeta),
      });
      refreshMyBatches();

      requestAnimationFrame(() => {
        createdSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [address, pendingCards, refreshMyBatches]
  );

  const handleFundTx = useCallback(
    (status: LifecycleStatus) => {
      if (
        status.statusName !== "success" &&
        status.statusName !== "transactionLegacyExecuted"
      ) {
        return;
      }
      const hash = txHashFromLifecycle(status);
      notifyVoucherTx(`✅ ${cardCount} voucher cards funded!`, hash);
      if (hash) void onCreateSuccess(hash);
    },
    [cardCount, notifyVoucherTx, onCreateSuccess]
  );

  const handleRedeemTx = useCallback(
    async (status: LifecycleStatus) => {
      if (status.statusName === "error") {
        setRedeemError("Redeem failed. Card may be used or secret invalid.");
        return;
      }
      if (
        status.statusName !== "success" &&
        status.statusName !== "transactionLegacyExecuted"
      ) {
        return;
      }

      const hash = txHashFromLifecycle(status);
      notifyVoucherTx(
        "Card redeemed to your wallet!",
        hash,
        redeemNotifiedRef
      );

      // Wait for confirmed success before clearing the form (avoids unmounting mid-flight)
      if (status.statusName !== "success") return;

      const parsed = redeemParsedRef.current;
      const preview = redeemPreviewRef.current;
      if (!parsed || !publicClient) return;

      if (preview) {
        setRedeemSuccess({
          cardId: preview.cardId,
          asset: preview.asset,
          amountPerCard: preview.amountPerCard,
          message: preview.message,
          txHash: hash || undefined,
        });
      }

      setRedeemCardId("");
      setRedeemSecret("");
      setRedeemError("");
      setRedeemKey((k) => k + 1);
      try {
        const result = await publicClient.readContract({
          address: VOUCHER_CONTRACT as `0x${string}`,
          abi: VOUCHER_ABI,
          functionName: "getBatch",
          args: [BigInt(parsed.batchId)],
        });
        await fetch("/api/vouchers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batchId: parsed.batchId,
            redeemedCount: Number(result[4]),
          }),
        });
      } catch {
        /* chain read optional */
      }
      refreshMyBatches();
    },
    [notifyVoucherTx, publicClient, refreshMyBatches]
  );

  const exactDepositLabel = formatVoucherAmount(asset, pendingTotal);

  return (
    <div className="space-y-4 pb-8">
      <VoucherHero />

      {!contractReady && (
        <SectionCard bar={false}>
          <div className="flex items-start gap-2 text-xs text-amber-200">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>
              Set <code className="text-amber-100">NEXT_PUBLIC_VOUCHER_CONTRACT</code> in{" "}
              <code className="text-amber-100">.env.local</code> to enable vouchers.
            </span>
          </div>
        </SectionCard>
      )}
      {contractReady && (
        <div className="flex justify-end">
          <a
            href={`https://basescan.org/address/${VOUCHER_CONTRACT}#code`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 hover:text-cyan-300"
          >
            <CheckCircle size={12} /> Verified contract on Basescan ↗
          </a>
        </div>
      )}

      <div className="flex gap-1 glass-panel p-1 rounded-2xl overflow-x-auto no-scrollbar">
        {(
          [
            ["create", "Create"],
            ["redeem", "Redeem"],
            ["view", "View"],
            ["mine", "My Cards"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex-1 min-w-[4.5rem] py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wide transition ${
              view === id ? "tab-active" : "text-slate-400 hover:text-white hover:bg-white/8"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "create" && (
        <SectionCard>
          <div className="space-y-4">
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Create gift batch</p>

          <div className="grid grid-cols-2 gap-2">
            {(["USDC", "ETH"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAsset(a)}
                className={`py-3 rounded-xl font-black text-sm border transition ${
                  asset === a
                    ? "bg-cyan-500/15 border-cyan-500/35 text-cyan-300"
                    : "bg-white/[0.03] border-white/8 text-slate-500"
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              Total deposit ({asset === "USDC" ? "USD" : "ETH"})
            </label>
            <input
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder={asset === "ETH" ? "0.01" : "10"}
              className="w-full mt-1 glass-panel-accent border border-cyan-500/20 rounded-xl px-3 py-3 text-white font-bold outline-none focus:border-cyan-500/40"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              e.g. {asset === "USDC" ? "$10 USDC" : "0.01 ETH"} split into {cardCountInput || "…"} cards
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              Number of cards (max {MAX_VOUCHER_CARDS})
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={cardCountInput}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setCardCountInput("");
                  return;
                }
                if (!/^\d+$/.test(raw)) return;
                const n = parseInt(raw, 10);
                if (n > MAX_VOUCHER_CARDS) return;
                setCardCountInput(raw);
              }}
              onBlur={() => {
                const n = parseInt(cardCountInput, 10);
                if (!cardCountInput || !Number.isFinite(n) || n < 1) {
                  setCardCountInput("1");
                } else if (n > MAX_VOUCHER_CARDS) {
                  setCardCountInput(String(MAX_VOUCHER_CARDS));
                } else {
                  setCardCountInput(String(n));
                }
              }}
              placeholder="1"
              className="w-full mt-1 glass-panel-accent border border-cyan-500/20 rounded-xl px-3 py-3 text-white font-bold outline-none focus:border-cyan-500/40"
            />
          </div>

          {split && (
            <div
              className={`rounded-2xl p-4 border ${
                split.valid
                  ? "glass-panel-accent border-cyan-500/25"
                  : "bg-orange-500/8 border-orange-500/30"
              }`}
            >
              <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-3">
                Split breakdown
              </p>
              {split.valid ? (
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Total</p>
                    <p className="text-sm font-black text-white mt-0.5">
                      {formatVoucherAmount(asset, split.total)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Cards</p>
                    <p className="text-sm font-black text-cyan-400 mt-0.5">{split.cardCount}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Per card</p>
                    <p className="text-sm font-black text-emerald-400 mt-0.5">
                      {formatVoucherAmount(asset, split.perCard)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-orange-300 font-bold mb-3">
                  {formatVoucherAmount(asset, split.total)} cannot split evenly into {cardCount} cards.
                  Adjust the total or card count so each card holds an equal amount.
                </p>
              )}
              {split.valid && (
                <>
                  <p className="text-xs text-slate-300 font-medium text-center">
                    {formatSplitSummary(split)}
                  </p>
                  <div className="mt-4 flex justify-center">
                    <VoucherGiftCard3D
                      asset={asset}
                      amount={split.perCard}
                      compact
                      showStack={false}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Message on card (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 280))}
              rows={3}
              placeholder="Happy day! Enjoy your onchain gift."
              className="w-full mt-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-cyan-500/40 resize-none"
            />
            <p className="text-[9px] text-slate-600 mt-1">{message.length}/280</p>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            Each wallet can redeem <span className="text-cyan-400 font-bold">one card per batch</span> — including the creator. Share unique Card ID + Secret per recipient.
          </p>

          {!pendingCards ? (
            <button
              type="button"
              onClick={prepareCreate}
              disabled={!contractReady || creating || !perCardWei}
              className="w-full py-3.5 rounded-xl font-black btn-primary disabled:opacity-40"
            >
              {creating ? "Preparing…" : "Generate Cards & Fund"}
            </button>
          ) : (
            <div className="space-y-3">
              <VoucherSecurityNotice
                asset={asset}
                exactAmount={exactDepositLabel}
                needsApproval={asset === "USDC" && needsUsdcApproval}
              />
              {asset === "ETH" ? (
                <Transaction
                  chainId={base.id}
                  calls={createEthCall}
                  capabilities={txCaps}
                  onStatus={handleFundTx}
                  onSuccess={(r) => {
                    const hash =
                      r.transactionReceipts[r.transactionReceipts.length - 1]?.transactionHash;
                    notifyVoucherTx(`✅ ${cardCount} voucher cards funded!`, hash);
                    if (hash) void onCreateSuccess(hash);
                  }}
                >
                  <TransactionButton
                    className="w-full py-3.5 rounded-xl font-black bg-cyan-500 hover:bg-cyan-400 text-white"
                    text={`Fund ${cardCount} ETH Vouchers`}
                  />
                </Transaction>
              ) : checkingAllowance ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 rounded-xl font-black bg-white/10 text-slate-500"
                >
                  Checking USDC allowance…
                </button>
              ) : (
                <Transaction
                  chainId={base.id}
                  calls={fundUsdcCalls}
                  capabilities={txCaps}
                  onStatus={handleFundTx}
                  onSuccess={(r) => {
                    const hash =
                      r.transactionReceipts[r.transactionReceipts.length - 1]?.transactionHash;
                    notifyVoucherTx(`✅ ${cardCount} voucher cards funded!`, hash);
                    if (hash) void onCreateSuccess(hash);
                  }}
                >
                  <TransactionButton
                    className="w-full py-3.5 rounded-xl font-black btn-primary text-white"
                    text={
                      needsUsdcApproval
                        ? `Approve & fund ${exactDepositLabel}`
                        : `Fund ${cardCount} USDC Vouchers`
                    }
                  />
                </Transaction>
              )}
            </div>
          )}

          {createdCards && (
            <div
              ref={createdSectionRef}
              className="border-2 border-emerald-400/40 bg-emerald-500/10 rounded-2xl p-4 sm:p-5 space-y-4 mt-4 scroll-mt-24"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 font-black text-base sm:text-lg">
                    <CheckCircle size={20} /> Your cards are ready!
                  </div>
                  <p className="text-sm text-white font-bold mt-1">Batch #{createdCards.batchId}</p>
                  <p className="text-xs text-cyan-300 font-bold mt-1">
                    {createdCards.cardCount} cards · {createdCards.cardCount} not redeemed yet
                  </p>
                  <p className="text-xs text-amber-200 font-bold mt-2">
                    Save Card ID + Secret for each card — they cannot be recovered later.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyText(formatBatchShareText(createdCards), `batch-${createdCards.batchId}`)}
                    className="flex items-center justify-center gap-2 text-sm font-black px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white hover:bg-white/15"
                  >
                    {copied === `batch-${createdCards.batchId}` ? <CheckCircle size={16} /> : <Copy size={16} />}
                    Copy all cards
                  </button>
                  <button
                    type="button"
                    onClick={() => shareText(formatBatchShareText(createdCards), `share-batch-${createdCards.batchId}`)}
                    className="flex items-center justify-center gap-2 text-sm font-black px-4 py-3 rounded-xl btn-primary"
                  >
                    <Share2 size={16} /> Share all
                  </button>
                </div>
              </div>

              {createdCards.message && (
                <p className="text-sm text-slate-300 italic px-1">&quot;{createdCards.message}&quot;</p>
              )}

              <div className="space-y-4">
                {createdCards.cards.map((c, i) => (
                  <VoucherCredentialCard
                    key={c.cardId}
                    cardId={c.cardId}
                    secret={c.secret}
                    asset={createdCards.asset}
                    amountPerCard={BigInt(createdCards.amountPerCard)}
                    index={i}
                    total={createdCards.cardCount}
                    copied={copied}
                    onCopy={copyText}
                    onShare={shareText}
                    shareText={formatCardShareText(c, createdCards)}
                  />
                ))}
              </div>
            </div>
          )}
          </div>
        </SectionCard>
      )}

      {view === "redeem" && (
        <SectionCard>
          <div className="space-y-4">
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Redeem voucher</p>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Card ID</label>
            <input
              value={redeemCardId}
              onChange={(e) => setRedeemCardId(e.target.value)}
              placeholder="e.g. 12-3"
              className="w-full mt-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-3 text-white font-mono outline-none focus:border-cyan-500/40"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Card secret</label>
            <input
              value={redeemSecret}
              onChange={(e) => setRedeemSecret(e.target.value.toUpperCase())}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              className="w-full mt-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-3 text-white font-mono tracking-wider outline-none focus:border-cyan-500/40"
            />
          </div>

          {redeemError && <p className="text-red-400 text-xs font-bold">{redeemError}</p>}

          {redeemPreviewLoading && redeemParsed && (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-500 text-sm">
              <RefreshCcw size={16} className="animate-spin" />
              Loading card details…
            </div>
          )}

          {redeemPreview && !redeemPreviewLoading && (
            <div className="glass-panel-accent border border-cyan-500/20 rounded-2xl p-4">
              <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-3">
                Your gift card
              </p>
              <VoucherCardPreview
                cardId={redeemPreview.cardId}
                asset={redeemPreview.asset}
                amount={redeemPreview.amountPerCard}
                message={redeemPreview.message}
                redeemed={redeemPreview.redeemed}
                showSecret={false}
              />
            </div>
          )}

          <p className="text-[10px] text-slate-500">
            You can only redeem <span className="text-cyan-400 font-bold">one card</span> per batch per wallet.
          </p>

          {contractReady && redeemCall.length > 0 && !redeemPreview?.redeemed ? (
            <Transaction
              key={redeemKey}
              chainId={base.id}
              calls={redeemCall}
              capabilities={txCaps}
              onStatus={handleRedeemTx}
              onSuccess={(r) => {
                const hash =
                  r.transactionReceipts[r.transactionReceipts.length - 1]?.transactionHash;
                notifyVoucherTx(
                  "Card redeemed to your wallet!",
                  hash,
                  redeemNotifiedRef
                );
              }}
            >
              <TransactionButton
                className="w-full py-3.5 rounded-xl font-black btn-primary text-white"
                text="Redeem to Wallet"
              />
            </Transaction>
          ) : (
            <button
              disabled
              className="w-full py-3.5 rounded-xl font-black bg-white/10 text-slate-600"
            >
              Enter Card ID & Secret
            </button>
          )}
          </div>
        </SectionCard>
      )}

      {view === "view" && (
        <SectionCard>
          <div className="space-y-4">
            <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
              <Search size={12} /> View voucher by Card ID
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Look up what&apos;s inside a Base Voucher onchain. Add the secret to verify the card key matches.
            </p>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Card ID</label>
              <input
                value={viewCardId}
                onChange={(e) => setViewCardId(e.target.value)}
                placeholder="e.g. 12-3"
                className="w-full mt-1 glass-panel-accent border border-cyan-500/20 rounded-xl px-3 py-3 text-white font-mono outline-none focus:border-cyan-500/40"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Secret (optional — verify key)</label>
              <input
                value={viewSecret}
                onChange={(e) => setViewSecret(e.target.value.toUpperCase())}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                className="w-full mt-1 glass-panel-accent border border-cyan-500/20 rounded-xl px-3 py-3 text-white font-mono tracking-wider outline-none focus:border-cyan-500/40"
              />
            </div>

            {viewError && <p className="text-red-400 text-xs font-bold">{viewError}</p>}

            <button
              type="button"
              onClick={lookupCard}
              disabled={!contractReady || viewLoading || !viewCardId.trim()}
              className="w-full py-3.5 rounded-xl font-black btn-primary disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {viewLoading ? (
                <>
                  <RefreshCcw size={16} className="animate-spin" /> Loading…
                </>
              ) : (
                <>
                  <Search size={16} /> View Card
                </>
              )}
            </button>

            {viewedCard && (
              <div className="space-y-4 pt-2">
                <VoucherCardPreview
                  cardId={viewedCard.cardId}
                  secret={viewSecret.trim() || undefined}
                  asset={viewedCard.asset}
                  amount={viewedCard.amountPerCard}
                  message={viewedCard.message}
                  redeemed={viewedCard.redeemed}
                  showSecret={Boolean(viewSecret.trim())}
                />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="glass-panel-accent rounded-xl p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Batch</p>
                    <p className="font-black text-white mt-0.5">#{viewedCard.batchId}</p>
                  </div>
                  <div className="glass-panel-accent rounded-xl p-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Redeemed</p>
                    <p className="font-black text-cyan-400 mt-0.5">
                      {viewedCard.redeemedCount}/{viewedCard.cardCount}
                    </p>
                  </div>
                  <div className="glass-panel-accent rounded-xl p-3 col-span-2">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Creator</p>
                    <p className="font-mono text-white mt-0.5 text-[11px] truncate">{viewedCard.creator}</p>
                  </div>
                </div>
                {viewedCard.secretValid === true && (
                  <p className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle size={14} /> Secret verified — this key matches the card onchain.
                  </p>
                )}
                {viewedCard.secretValid === false && (
                  <p className="text-red-400 text-xs font-bold flex items-center gap-1.5">
                    <AlertCircle size={14} /> Secret does not match this card.
                  </p>
                )}
                {!viewedCard.redeemed && (
                  <button
                    type="button"
                    onClick={() => {
                      setRedeemCardId(viewedCard.cardId);
                      setRedeemSecret(viewSecret);
                      setView("redeem");
                    }}
                    className="w-full py-3 rounded-xl font-black bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25"
                  >
                    Go to Redeem →
                  </button>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {view === "mine" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Your voucher batches</p>
            <button onClick={refreshMyBatches} className="text-slate-500 hover:text-cyan-400 p-1">
              <RefreshCcw size={14} />
            </button>
          </div>

          {creatorSummary && creatorSummary.batchCount > 0 && (
            <SectionCard bar={false} className="border border-amber-500/25 bg-amber-500/5">
              <p className="text-[10px] font-black text-amber-300/80 uppercase tracking-widest">Wallet summary</p>
              <p className="text-white font-black text-lg mt-1">
                {creatorSummary.totalUnredeemed} of {creatorSummary.totalCards} cards not redeemed yet
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Across {creatorSummary.batchCount} batch{creatorSummary.batchCount === 1 ? "" : "es"} you created
              </p>
            </SectionCard>
          )}

          {myBatches.length === 0 ? (
            <SectionCard>
              <div className="py-8 text-center">
                <CreditCard size={28} className="text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-bold">No vouchers yet. Create your first batch!</p>
              </div>
            </SectionCard>
          ) : (
            myBatches.map((b) => {
              const redeemed = chainStats[b.batchId] ?? 0;
              const unredeemed = Math.max(0, b.cardCount - redeemed);
              const pct = Math.round((redeemed / b.cardCount) * 100);
              const cardStatuses = batchCardStatuses[b.batchId];
              const hasLocalSecrets = b.cards.some((c) => c.secret.length > 0);
              return (
                <SectionCard key={b.batchId} bar={false} className="border border-cyan-500/20">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      setExpandedBatchId(b.batchId);
                      void loadBatchDetail(b.batchId);
                    }}
                  >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-black text-white">Batch #{b.batchId}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatVoucherAmount(b.asset, BigInt(b.totalAmount))} · {b.cardCount} cards
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {redeemed}/{b.cardCount} redeemed
                      </span>
                      {unredeemed > 0 && (
                        <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {unredeemed} not redeemed yet
                        </span>
                      )}
                    </div>
                  </div>
                  </button>
                  {b.message && (
                    <p className="text-xs text-slate-400 italic mb-3">&quot;{b.message}&quot;</p>
                  )}
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden mb-3">
                    <div
                      className="h-full bg-linear-to-r from-rose-500 to-cyan-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedBatchId(b.batchId);
                        void loadBatchDetail(b.batchId);
                      }}
                      className="flex items-center gap-2 text-sm font-black px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/20"
                    >
                      {loadingBatchDetail === b.batchId ? "Loading…" : "View redemption status"}
                    </button>
                    {hasLocalSecrets && (
                      <>
                    <button
                      type="button"
                      onClick={() => copyText(formatBatchShareText(b), `batch-${b.batchId}`)}
                      className="flex items-center gap-2 text-sm font-black px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white hover:bg-white/15"
                    >
                      {copied === `batch-${b.batchId}` ? <CheckCircle size={14} /> : <Copy size={14} />}
                      Copy all cards
                    </button>
                    <button
                      type="button"
                      onClick={() => shareText(formatBatchShareText(b), `share-batch-${b.batchId}`)}
                      className="flex items-center gap-2 text-sm font-black px-4 py-2.5 rounded-xl btn-primary"
                    >
                      <Share2 size={14} /> Share batch
                    </button>
                      </>
                    )}
                  </div>

                  {expandedBatchId === b.batchId && cardStatuses && (
                    <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Per-card status
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {cardStatuses.map((c) => (
                          <div
                            key={c.cardId}
                            className={`rounded-lg px-2 py-2 text-xs font-bold border ${
                              c.redeemed
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                            }`}
                          >
                            <span className="font-mono">{c.cardId}</span>
                            <p className="mt-0.5 text-[10px] uppercase tracking-wide opacity-80">
                              {c.redeemed ? "Redeemed" : "Available"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasLocalSecrets && (
                  <details
                    className="group"
                    open={expandedBatchId === b.batchId || b.cardCount <= 3}
                    onToggle={(e) => {
                      if ((e.target as HTMLDetailsElement).open) {
                        setExpandedBatchId(b.batchId);
                        void loadBatchDetail(b.batchId);
                      }
                    }}
                  >
                    <summary className="cursor-pointer list-none flex items-center justify-between gap-2 py-2 text-cyan-400 font-black text-sm">
                      <span className="flex items-center gap-2">
                        <Coins size={14} /> Show all Card IDs & secrets ({b.cardCount})
                      </span>
                      <ChevronDown size={16} className="group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="mt-3 space-y-4 max-h-[min(70vh,600px)] overflow-y-auto pr-1">
                      {b.cards.map((c, i) => (
                        <VoucherCredentialCard
                          key={c.cardId}
                          cardId={c.cardId}
                          secret={c.secret}
                          asset={b.asset}
                          amountPerCard={BigInt(b.amountPerCard)}
                          index={i}
                          total={b.cardCount}
                          copied={copied}
                          onCopy={copyText}
                          onShare={shareText}
                          shareText={formatCardShareText(c, b)}
                        />
                      ))}
                    </div>
                  </details>
                  )}
                </SectionCard>
              );
            })
          )}
        </div>
      )}
      <VoucherWhySection />

      <VoucherRedeemReveal
        key={redeemSuccess?.cardId ?? "closed"}
        data={redeemSuccess}
        onClose={() => setRedeemSuccess(null)}
      />
    </div>
  );
}
