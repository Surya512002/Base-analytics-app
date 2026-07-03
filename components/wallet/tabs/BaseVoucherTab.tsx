"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Transaction, TransactionButton } from "@coinbase/onchainkit/transaction";
import { encodeContractCall, prepareCallsForWalletSendCalls } from "@/lib/utils/tx";
import { base } from "viem/chains";
import { usePublicClient } from "wagmi";
import {
  Copy,
  CreditCard,
  RefreshCcw,
  CheckCircle,
  AlertCircle,
  Share2,
  Search,
} from "lucide-react";
import {
  ERC20_ABI,
  USDC_BASE,
  VOUCHER_ABI,
} from "@/lib/constants/contracts";
import { VOUCHER_CONTRACT, APP_URL_WEB } from "@/lib/constants/env";
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
  loadPendingBatch,
  loadAnyPendingBatch,
  loadPendingBatchForTx,
  savePendingBatchForTx,
  clearPendingBatch,
  savePendingBatch,
  saveLastVoucherTx,
  loadLastVoucherTx,
  parseCardId,
  parseEthAmount,
  parseUsdcAmount,
  saveLocalBatch,
  mergeSecretsIntoBatch,
  tokenToAsset,
} from "@/lib/utils/voucher";
import { confirmVoucherBatchCreate, finalizePendingBatchFromTx, asConfirmClient } from "@/lib/voucher/confirm-create";
import {
  getOnchainKitCapabilities,
  usesWalletSendCallsAttribution,
} from "@/lib/utils/paymaster";
import { writePersistedTxKeys } from "@/lib/utils/wallet-session";
import SectionCard from "@/components/ui/SectionCard";
import VoucherHero from "@/components/wallet/VoucherHero";
import VoucherGiftCard3D from "@/components/wallet/VoucherGiftCard3D";
import VoucherWhySection from "@/components/wallet/VoucherWhySection";
import VoucherCredentialCard from "@/components/wallet/VoucherCredentialCard";
import VoucherSecurityNotice from "@/components/wallet/VoucherSecurityNotice";
import VoucherRedeemReveal from "@/components/wallet/VoucherRedeemReveal";
import VoucherSharePanel from "@/components/wallet/VoucherSharePanel";
import { buildPayLinkUrl } from "@/lib/utils/voucher-share";
import { VOUCHER_TEMPLATES } from "@/lib/constants/voucher-templates";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { txHashFromLifecycle } from "@/lib/utils/tx-status";
import type { LifecycleStatus } from "@coinbase/onchainkit/transaction";

type VoucherView = "create" | "redeem" | "view" | "mine";

const USDC_PRESETS = [
  { label: "$1", total: "1", cards: "1" },
  { label: "$5", total: "5", cards: "5" },
  { label: "$10", total: "10", cards: "10" },
  { label: "$25", total: "25", cards: "25" },
] as const;

const ETH_PRESETS = [
  { label: "0.001", total: "0.001", cards: "1" },
  { label: "0.005", total: "0.005", cards: "5" },
  { label: "0.01", total: "0.01", cards: "10" },
  { label: "0.025", total: "0.025", cards: "25" },
] as const;

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

function RedeemStatusBanner({
  cardId,
  redeemed,
  loading,
}: {
  cardId?: string;
  redeemed?: boolean;
  loading?: boolean;
}) {
  if (loading || !redeemed || !cardId) return null;

  return (
    <div
      role="alert"
      className="rounded-2xl border-2 border-red-400/55 bg-red-500/15 px-4 py-4 flex items-start gap-3"
    >
      <AlertCircle size={22} className="text-red-300 shrink-0 mt-0.5" />
      <div>
        <p className="text-base sm:text-lg font-black text-red-100">This card is already redeemed</p>
        <p className="text-sm text-red-200/85 mt-1 leading-relaxed">
          Card{" "}
          <span className="font-mono font-bold text-white">{cardId}</span> was already claimed on Base.
          You cannot redeem it again — the funds have been sent to whoever redeemed it first.
        </p>
      </div>
    </div>
  );
}

function VoucherCardPreview({
  cardId,
  secret,
  asset,
  amount,
  message,
  redeemed,
  showSecret = true,
  showRedeemedNotice = true,
}: {
  cardId: string;
  secret?: string;
  asset: VoucherAsset;
  amount: bigint;
  message?: string;
  redeemed?: boolean;
  showSecret?: boolean;
  showRedeemedNotice?: boolean;
}) {
  return (
    <div className="space-y-3">
      {showRedeemedNotice && redeemed && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
          <AlertCircle size={16} className="text-amber-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-amber-200">This card has already been redeemed</p>
            <p className="text-xs text-amber-200/70 mt-0.5">
              Card <span className="font-mono font-bold">{cardId}</span> was used onchain and cannot be redeemed again.
            </p>
          </div>
        </div>
      )}
      <VoucherGiftCard3D
        asset={asset}
        amount={amount}
        message={message}
        status={redeemed ? "redeemed" : "active"}
        compact
        flat
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
  const { showToast, setSponsored, setTab, wallet, setTxKeys, connType } = app;
  const address = wallet?.address as `0x${string}` | undefined;
  const publicClient = usePublicClient({ chainId: base.id });
  const txCaps = useMemo(
    () => getOnchainKitCapabilities(connType),
    [connType]
  );
  const prepareOnchainKitCalls = useCallback(
    (calls: ReturnType<typeof encodeContractCall>[]) =>
      usesWalletSendCallsAttribution(connType)
        ? prepareCallsForWalletSendCalls(calls)
        : calls,
    [connType]
  );
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
  const confirmingCreateRef = useRef(false);

  const [redeemCardId, setRedeemCardId] = useState("");
  const [redeemSecret, setRedeemSecret] = useState("");
  const [redeemError, setRedeemError] = useState("");
  const [redeemKey, setRedeemKey] = useState(0);
  const [redeemPreview, setRedeemPreview] = useState<RedeemPreview | null>(null);
  const [redeemPreviewLoading, setRedeemPreviewLoading] = useState(false);
  const [redeemPreviewRefreshing, setRedeemPreviewRefreshing] = useState(false);
  const [debouncedRedeemCardId, setDebouncedRedeemCardId] = useState("");
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
  const [mineStatusesLoading, setMineStatusesLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [recoverTxInput, setRecoverTxInput] = useState("");
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverError, setRecoverError] = useState("");
  const [confirmingDeposit, setConfirmingDeposit] = useState(false);

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

  const upsertBatchInMap = useCallback(
    (
      merged: Map<number, StoredVoucherBatch>,
      b: {
        batchId: number;
        asset: VoucherAsset;
        totalAmount: string;
        amountPerCard: string;
        cardCount: number;
        message: string;
        creator: string;
        createdAt?: number;
        txHash?: string;
      }
    ) => {
      const existing = merged.get(b.batchId);
      merged.set(b.batchId, {
        batchId: b.batchId,
        asset: b.asset,
        totalAmount: b.totalAmount,
        amountPerCard: b.amountPerCard,
        cardCount: b.cardCount,
        message: b.message,
        creator: b.creator,
        createdAt: b.createdAt ?? existing?.createdAt ?? Date.now(),
        txHash: b.txHash ?? existing?.txHash,
        cards:
          existing?.cards.some((c) => c.secret.length > 0)
            ? existing.cards
            : Array.from({ length: b.cardCount }, (_, i) => ({
                batchId: b.batchId,
                cardIndex: i,
                cardId: formatCardId(b.batchId, i),
                secret: existing?.cards[i]?.secret ?? "",
              })),
      });
    },
    []
  );

  const refreshMyBatches = useCallback(async () => {
    if (!address) return;
    const local = loadLocalBatches(address);
    const merged = new Map(local.map((b) => [b.batchId, b]));
    const stats: Record<number, number> = {};

    const pending = loadPendingBatch(address);
    if (pending) {
      upsertBatchInMap(merged, {
        ...pending,
        creator: address,
      });
    }

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
          upsertBatchInMap(merged, b);
        }
        setChainStats(stats);

        const withSecrets = [...merged.values()].map((b) => {
          const mergedBatch = mergeSecretsIntoBatch(b);
          if (
            address &&
            mergedBatch.cards.some((c) => c.secret.length > 0) &&
            !b.cards.some((c) => c.secret.length > 0)
          ) {
            saveLocalBatch(address, mergedBatch);
          }
          return mergedBatch;
        });
        setMyBatches(withSecrets.sort((a, b) => b.batchId - a.batchId));
        return;
      }
    } catch {
      /* fall through to local + RPC */
    }

    setCreatorSummary(
      merged.size > 0
        ? {
            batchCount: merged.size,
            totalCards: [...merged.values()].reduce((s, b) => s + b.cardCount, 0),
            totalUnredeemed: [...merged.values()].reduce(
              (s, b) => s + Math.max(0, b.cardCount - (stats[b.batchId] ?? 0)),
              0
            ),
          }
        : null
    );
    if (!publicClient || !contractReady) {
      const withSecrets = [...merged.values()].map((b) => mergeSecretsIntoBatch(b));
      setMyBatches(withSecrets.sort((a, b) => b.batchId - a.batchId));
      return;
    }

    for (const b of merged.values()) {
      try {
        const result = await publicClient.readContract({
          address: VOUCHER_CONTRACT as `0x${string}`,
          abi: VOUCHER_ABI,
          functionName: "getBatch",
          args: [BigInt(b.batchId)],
        });
        stats[b.batchId] = Number(result[4]);
      } catch {
        stats[b.batchId] = stats[b.batchId] ?? 0;
      }
    }
    setChainStats(stats);
    const withSecrets = [...merged.values()].map((b) => {
      const mergedBatch = mergeSecretsIntoBatch(b);
      if (
        address &&
        mergedBatch.cards.some((c) => c.secret.length > 0) &&
        !b.cards.some((c) => c.secret.length > 0)
      ) {
        saveLocalBatch(address, mergedBatch);
      }
      return mergedBatch;
    });
    setMyBatches(withSecrets.sort((a, b) => b.batchId - a.batchId));
  }, [address, publicClient, contractReady, upsertBatchInMap]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlCard = new URLSearchParams(window.location.search).get("card");
    const stored = localStorage.getItem("base_redeem_card");
    const card = (urlCard || stored || "").trim();
    if (!card) return;
    setView("redeem");
    setRedeemCardId(card);
    setDebouncedRedeemCardId(card);
    localStorage.removeItem("base_redeem_card");
  }, []);

  const activePresets = asset === "USDC" ? USDC_PRESETS : ETH_PRESETS;
  const activePresetKey = `${totalAmount}:${cardCountInput}`;

  const cardRedeemedMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const cards of Object.values(batchCardStatuses)) {
      for (const c of cards) map.set(c.cardId, c.redeemed);
    }
    return map;
  }, [batchCardStatuses]);

  const isCardRedeemed = useCallback(
    (cardId: string) => cardRedeemedMap.get(cardId) ?? false,
    [cardRedeemedMap]
  );

  const isCardStatusKnown = useCallback(
    (cardId: string) => cardRedeemedMap.has(cardId),
    [cardRedeemedMap]
  );

  useEffect(() => {
    if (!createdCards) return;
    void loadBatchDetail(createdCards.batchId);
  }, [createdCards, loadBatchDetail]);

  const displayCardsForBatch = useCallback((b: StoredVoucherBatch) => {
    const withSecrets = mergeSecretsIntoBatch(b);
    if (withSecrets.cards.length >= withSecrets.cardCount && withSecrets.cards.every((c) => c.cardId)) {
      return withSecrets.cards;
    }
    return Array.from({ length: withSecrets.cardCount }, (_, i) => ({
      batchId: withSecrets.batchId,
      cardIndex: i,
      cardId: formatCardId(withSecrets.batchId, i),
      secret: withSecrets.cards[i]?.secret ?? "",
    }));
  }, []);

  useEffect(() => {
    if (view !== "mine" || myBatches.length === 0) return;
    let cancelled = false;
    setMineStatusesLoading(true);

    const first = myBatches[0];
    if (expandedBatchId === null) {
      setExpandedBatchId(first.batchId);
    }

    void (async () => {
      await Promise.all(myBatches.map((b) => loadBatchDetail(b.batchId)));
      if (!cancelled) setMineStatusesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [view, myBatches, loadBatchDetail, expandedBatchId]);

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
      savePendingBatch(address, batch);
      createHandledRef.current = false;
      setUsdcApproveCompleted(false);
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
  const [usdcApproveCompleted, setUsdcApproveCompleted] = useState(false);

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

  const usdcReadyToFund =
    asset !== "USDC" || (usdcAllowance !== null && usdcAllowance >= pendingTotal);

  const refreshUsdcAllowance = useCallback(async () => {
    if (!address || !publicClient || !VOUCHER_CONTRACT) return;
    try {
      const value = await publicClient.readContract({
        address: USDC_BASE as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, VOUCHER_CONTRACT as `0x${string}`],
      });
      setUsdcAllowance(value);
    } catch {
      setUsdcAllowance(null);
    }
  }, [address, publicClient]);

  const redeemParsedForTx = useMemo(
    () => parseCardId(redeemCardId.trim()),
    [redeemCardId]
  );
  const redeemParsed = parseCardId(debouncedRedeemCardId);
  redeemParsedRef.current = redeemParsedForTx;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedRedeemCardId(redeemCardId.trim()), 450);
    return () => window.clearTimeout(timer);
  }, [redeemCardId]);

  useEffect(() => {
    redeemNotifiedRef.current = "";
  }, [redeemKey]);

  useEffect(() => {
    if (!redeemParsed || !contractReady) {
      if (!parseCardId(redeemCardId.trim())) {
        setRedeemPreview(null);
        redeemPreviewRef.current = null;
      }
      setRedeemPreviewLoading(false);
      setRedeemPreviewRefreshing(false);
      return;
    }

    const lookupCardId = formatCardId(redeemParsed.batchId, redeemParsed.cardIndex);
    const hasSamePreview = redeemPreviewRef.current?.cardId === lookupCardId;
    let cancelled = false;

    if (!hasSamePreview) {
      setRedeemPreviewLoading(true);
    } else {
      setRedeemPreviewRefreshing(true);
    }
    setRedeemError("");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    void (async () => {
      try {
        const res = await fetch(
          `/api/vouchers?batchId=${redeemParsed.batchId}&live=1`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (!res.ok) throw new Error("lookup failed");

        const data = (await res.json()) as {
          batch?: {
            asset: VoucherAsset;
            amountPerCard: string;
            message: string;
            cardCount: number;
          };
          cards?: Array<{ cardIndex: number; cardId: string; redeemed: boolean }>;
        };

        if (cancelled) return;

        const batch = data.batch;
        if (!batch || batch.cardCount < 1) {
          setRedeemPreview(null);
          redeemPreviewRef.current = null;
          setRedeemError("Batch not found onchain.");
          return;
        }
        if (redeemParsed.cardIndex >= batch.cardCount) {
          setRedeemPreview(null);
          redeemPreviewRef.current = null;
          setRedeemError(`This batch only has cards 0–${batch.cardCount - 1}.`);
          return;
        }

        const cardStatus = data.cards?.find((c) => c.cardIndex === redeemParsed.cardIndex);
        const preview: RedeemPreview = {
          cardId: lookupCardId,
          asset: batch.asset,
          amountPerCard: BigInt(batch.amountPerCard),
          message: batch.message ?? "",
          redeemed: cardStatus?.redeemed ?? false,
        };
        setRedeemPreview(preview);
        redeemPreviewRef.current = preview;
        setRedeemError("");
      } catch (err) {
        if (cancelled) return;
        if (!hasSamePreview) {
          setRedeemPreview(null);
          redeemPreviewRef.current = null;
        }
        const aborted = err instanceof Error && err.name === "AbortError";
        setRedeemError(
          aborted
            ? "Loading timed out. Check your connection and try again."
            : "Could not load card details. Try again in a moment."
        );
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) {
          setRedeemPreviewLoading(false);
          setRedeemPreviewRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [redeemParsed, contractReady, redeemKey]);
  const redeemCall = useMemo(() => {
    if (!redeemParsedForTx || !redeemSecret.trim() || !contractReady) return [];
    return [
      encodeContractCall(VOUCHER_CONTRACT as `0x${string}`, VOUCHER_ABI, "redeem", [
        BigInt(redeemParsedForTx.batchId),
        BigInt(redeemParsedForTx.cardIndex),
        redeemSecret.trim().toUpperCase(),
      ]),
    ];
  }, [redeemParsedForTx, redeemSecret, contractReady]);

  const resolvePendingBatch = useCallback(
    (txHash?: string): StoredVoucherBatch | null => {
      if (!address) return loadAnyPendingBatch(txHash);
      return (
        (txHash ? loadPendingBatchForTx(txHash) : null) ??
        pendingCards ??
        pendingBatchRef.current ??
        loadPendingBatch(address) ??
        loadAnyPendingBatch(txHash)
      );
    },
    [address, pendingCards]
  );

  const finalizeCreatedBatch = useCallback(
    async (batch: StoredVoucherBatch, txHash?: string) => {
      if (!address) return false;

      const pending = resolvePendingBatch(txHash);
      const cardsWithSecrets = batch.cards.map((c, i) => ({
        ...c,
        secret: pending?.cards[i]?.secret ?? c.secret,
      }));
      const hasSecrets = cardsWithSecrets.some((c) => c.secret.length > 0);

      const saved = {
        ...batch,
        creator: address,
        txHash,
        cards: cardsWithSecrets,
      };
      saveLocalBatch(address, saved);
      clearPendingBatch(address, txHash);
      if (txHash) saveLastVoucherTx(address, txHash);
      setCreatedCards(saved);
      setPendingCards(null);
      pendingBatchRef.current = null;
      setExpandedBatchId(saved.batchId);
      setView("create");
      setConfirmingDeposit(false);

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

      if (!hasSecrets) {
        showToast(
          "Batch confirmed — Card ID saved. Secret was not found on this device.",
          txHash ?? ""
        );
      }
      return hasSecrets;
    },
    [address, refreshMyBatches, resolvePendingBatch, showToast]
  );

  const tryShowCardsWithSecrets = useCallback(
    async (txHash?: string): Promise<boolean> => {
      if (!address || !publicClient || createHandledRef.current) return false;

      const pending = resolvePendingBatch(txHash);
      if (!pending) return false;

      confirmingCreateRef.current = true;
      setConfirmingDeposit(true);
      try {
        if (txHash) {
          const fromSecrets = await finalizePendingBatchFromTx(
            asConfirmClient(publicClient),
            pending,
            txHash
          );
          if (fromSecrets) {
            createHandledRef.current = true;
            return (await finalizeCreatedBatch(fromSecrets, txHash)) ?? false;
          }
        }

        const confirmed = await confirmVoucherBatchCreate(
          asConfirmClient(publicClient),
          pending,
          address,
          txHash
        );
        if (!confirmed) return false;

        createHandledRef.current = true;
        return (await finalizeCreatedBatch(confirmed, txHash)) ?? false;
      } finally {
        confirmingCreateRef.current = false;
        setConfirmingDeposit(false);
      }
    },
    [address, publicClient, resolvePendingBatch, finalizeCreatedBatch]
  );

  const onCreateSuccess = useCallback(
    async (txHash?: string): Promise<boolean> => {
      if (!address || !publicClient) return false;
      return tryShowCardsWithSecrets(txHash);
    },
    [address, publicClient, tryShowCardsWithSecrets]
  );

  useEffect(() => {
    if (!address) return;
    const local = loadLocalBatches(address);
    const withSecrets = local.find((b) => b.cards.some((c) => c.secret.length > 0));
    if (withSecrets && !createdCards) {
      setCreatedCards(withSecrets);
      setView("create");
    }
  }, [address, createdCards]);

  useEffect(() => {
    if (!address || !publicClient || !contractReady || createdCards) return;
    const stored = resolvePendingBatch();
    if (!stored) return;

    pendingBatchRef.current = stored;
    setPendingCards(stored);

    const lastTx = loadLastVoucherTx(address);

    void (async () => {
      const ok = await tryShowCardsWithSecrets(lastTx ?? undefined);
      if (ok) {
        showToast("✅ Your voucher cards are ready!", lastTx ?? "");
      }
    })();
  }, [
    address,
    publicClient,
    contractReady,
    createdCards,
    resolvePendingBatch,
    tryShowCardsWithSecrets,
    showToast,
  ]);

  const recoverBatchByTx = useCallback(
    async (txHash: string) => {
      if (!address || !publicClient) return false;
      const hash = txHash.trim();
      if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
        setRecoverError("Enter a valid transaction hash (0x…).");
        return false;
      }

      setRecoverLoading(true);
      setRecoverError("");
      try {
        const res = await fetch(
          `/api/vouchers?creator=${encodeURIComponent(address)}&tx=${encodeURIComponent(hash)}&live=1`
        );
        const data = (await res.json()) as {
          recovered?: boolean;
          batch?: {
            batchId: number;
            asset: VoucherAsset;
            totalAmount: string;
            amountPerCard: string;
            cardCount: number;
            message: string;
            redeemedCount: number;
          };
        };

        if (!data.recovered || !data.batch) {
          setRecoverError(
            "No voucher batch found for your wallet in this transaction."
          );
          return false;
        }

        saveLastVoucherTx(address, hash);

        const pending = resolvePendingBatch(hash);
        if (pending) {
          const fromSecrets = pending.cards.some((c) => c.secret)
            ? await finalizePendingBatchFromTx(
                asConfirmClient(publicClient),
                pending,
                hash
              )
            : null;
          if (fromSecrets) {
            createHandledRef.current = true;
            await finalizeCreatedBatch(fromSecrets, hash);
            showToast("✅ Voucher cards recovered with secrets!", hash);
            return true;
          }

          const confirmed = await confirmVoucherBatchCreate(
            asConfirmClient(publicClient),
            pending,
            address,
            hash
          );
          if (confirmed) {
            createHandledRef.current = true;
            await finalizeCreatedBatch(confirmed, hash);
            const hasSecrets = confirmed.cards.some((c) => c.secret.length > 0);
            showToast(
              hasSecrets
                ? "✅ Voucher cards recovered with secrets!"
                : "Batch linked — Card ID saved. Secret was not on this device.",
              hash
            );
            return true;
          }
        }

        const placeholder: StoredVoucherBatch = mergeSecretsIntoBatch({
          batchId: data.batch.batchId,
          asset: data.batch.asset,
          totalAmount: data.batch.totalAmount,
          amountPerCard: data.batch.amountPerCard,
          cardCount: data.batch.cardCount,
          message: data.batch.message,
          creator: address,
          createdAt: Date.now(),
          txHash: hash,
          cards: Array.from({ length: data.batch.cardCount }, (_, i) => ({
            batchId: data.batch!.batchId,
            cardIndex: i,
            cardId: formatCardId(data.batch!.batchId, i),
            secret: "",
          })),
        });
        saveLocalBatch(address, placeholder);
        await fetch("/api/vouchers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batchId: placeholder.batchId,
            creator: address,
            asset: placeholder.asset,
            totalAmount: placeholder.totalAmount,
            amountPerCard: placeholder.amountPerCard,
            cardCount: placeholder.cardCount,
            message: placeholder.message,
            redeemedCount: data.batch.redeemedCount ?? 0,
            createdAt: placeholder.createdAt,
            txHash: hash,
          } satisfies VoucherBatchMeta),
        });
        await refreshMyBatches();
        setCreatedCards(placeholder);
        setExpandedBatchId(placeholder.batchId);
        setView("mine");
        const recoveredSecrets = placeholder.cards.some((c) => c.secret.length > 0);
        showToast(
          recoveredSecrets
            ? "✅ Voucher cards recovered with secrets!"
            : "Batch linked — Card ID saved. Secret was not stored when you deposited (app bug, not cleared history).",
          hash
        );
        return true;
      } catch {
        setRecoverError("Recovery failed — try again in a moment.");
        return false;
      } finally {
        setRecoverLoading(false);
      }
    },
    [address, publicClient, finalizeCreatedBatch, refreshMyBatches, showToast, resolvePendingBatch]
  );

  useEffect(() => {
    if (view !== "mine" || !address || recoverLoading) return;
    const lastTx = loadLastVoucherTx(address);
    if (lastTx) setRecoverTxInput(lastTx);
    if (!lastTx || myBatches.length > 0) return;

    void (async () => {
      const pending = loadAnyPendingBatch(lastTx);
      if (pending?.cards.some((c) => c.secret)) {
        const ok = await tryShowCardsWithSecrets(lastTx);
        if (ok) return;
      }
      await recoverBatchByTx(lastTx);
    })();
  }, [view, address, myBatches.length, recoverLoading, recoverBatchByTx, tryShowCardsWithSecrets]);

  const handleApproveTx = useCallback(
    (status: LifecycleStatus) => {
      if (
        status.statusName !== "success" &&
        status.statusName !== "transactionLegacyExecuted"
      ) {
        return;
      }
      notifyVoucherTx(
        "✅ USDC approved — now confirm funding to create your cards",
        txHashFromLifecycle(status)
      );
      setUsdcApproveCompleted(true);
      void refreshUsdcAllowance();
    },
    [notifyVoucherTx, refreshUsdcAllowance]
  );

  useEffect(() => {
    if (!pendingCards || !address || !publicClient || createdCards || createHandledRef.current) {
      return;
    }

    const lastTx = loadLastVoucherTx(address);
    let attempts = 0;
    const maxAttempts = 30;

    const interval = window.setInterval(() => {
      if (createHandledRef.current || attempts >= maxAttempts) return;
      attempts += 1;
      void onCreateSuccess(lastTx ?? undefined);
    }, 4_000);

    return () => window.clearInterval(interval);
  }, [pendingCards, address, publicClient, createdCards, onCreateSuccess]);

  useEffect(() => {
    const hasPendingSecrets =
      pendingCards?.cards.some((c) => c.secret.length > 0) ||
      confirmingDeposit ||
      confirmingCreateRef.current;
    if (!hasPendingSecrets) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendingCards, confirmingDeposit]);

  const handleFundTx = useCallback(
    (status: LifecycleStatus) => {
      if (
        status.statusName !== "success" &&
        status.statusName !== "transactionLegacyExecuted"
      ) {
        return;
      }
      const hash = txHashFromLifecycle(status);
      const pending = resolvePendingBatch();
      if (hash && pending) {
        savePendingBatchForTx(hash, pending);
        if (address) saveLastVoucherTx(address, hash);
      } else if (hash && address) {
        saveLastVoucherTx(address, hash);
      }
      setConfirmingDeposit(true);
      void (async () => {
        const ok = await onCreateSuccess(hash || undefined);
        if (ok) {
          notifyVoucherTx(`✅ ${cardCount} voucher cards ready!`, hash);
        } else if (hash) {
          const recovered = await recoverBatchByTx(hash);
          if (!recovered) {
            showToast(
              "Deposit sent — confirming on Base… keep this tab open until cards appear.",
              hash
            );
          }
        } else {
          showToast(
            "Deposit sent — confirming on Base… Your cards will appear shortly.",
            ""
          );
        }
      })();
    },
    [
      address,
      cardCount,
      notifyVoucherTx,
      onCreateSuccess,
      recoverBatchByTx,
      resolvePendingBatch,
      showToast,
    ]
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

      if (wallet) {
        setTxKeys((k) => {
          const next = { ...k, redeem: (k.redeem || 0) + 1 };
          writePersistedTxKeys(wallet.address, next);
          return next;
        });
      }

      setBatchCardStatuses((prev) => {
        const cards = prev[parsed.batchId];
        const cardId = formatCardId(parsed.batchId, parsed.cardIndex);
        if (cards) {
          return {
            ...prev,
            [parsed.batchId]: cards.map((c) =>
              c.cardIndex === parsed.cardIndex ? { ...c, redeemed: true } : c
            ),
          };
        }
        return {
          ...prev,
          [parsed.batchId]: [
            {
              cardIndex: parsed.cardIndex,
              cardId,
              redeemed: true,
            },
          ],
        };
      });

      setRedeemError("");
      try {
        const result = await publicClient.readContract({
          address: VOUCHER_CONTRACT as `0x${string}`,
          abi: VOUCHER_ABI,
          functionName: "getBatch",
          args: [BigInt(parsed.batchId)],
        });
        setChainStats((prev) => ({
          ...prev,
          [parsed.batchId]: Number(result[4]),
        }));
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
    [notifyVoucherTx, publicClient, refreshMyBatches, wallet, setTxKeys]
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
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Occasion templates</p>
            <div className="flex flex-wrap gap-2">
              {VOUCHER_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setAsset(t.asset);
                    setTotalAmount(t.total);
                    setCardCountInput(t.cards);
                    setMessage(t.message);
                  }}
                  className="preset-chip rounded-full px-3 py-2 text-[10px] font-black text-slate-400 hover:text-white"
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Quick presets</p>
            <div className="flex flex-wrap gap-2">
              {activePresets.map((p) => {
                const key = `${p.total}:${p.cards}`;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTotalAmount(p.total);
                      setCardCountInput(p.cards);
                    }}
                    className={`preset-chip rounded-full px-4 py-2 text-xs font-black ${
                      activePresetKey === key ? "preset-chip-active" : "text-slate-400"
                    }`}
                  >
                    {p.label}
                    <span className="text-[9px] font-bold opacity-70 ml-1">
                      · {p.cards} card{p.cards !== "1" ? "s" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
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
              {creating ? "Preparing…" : "Create cards"}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/8 px-4 py-3">
                <p className="text-sm font-black text-cyan-200">Confirm in your wallet to create cards</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Card IDs and secret keys are generated now but{" "}
                  <span className="text-white font-bold">only shown after your deposit confirms</span>
                  {asset === "USDC" && needsUsdcApproval
                    ? " — USDC requires approval first, then a separate deposit confirmation."
                    : "."}
                </p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Already deposited? Your cards will appear automatically once Base confirms the transaction.
                </p>
              </div>
              <VoucherSecurityNotice
                asset={asset}
                exactAmount={exactDepositLabel}
                needsApproval={asset === "USDC" && needsUsdcApproval}
              />
              {confirmingDeposit && (
                <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 animate-pulse">
                  <p className="text-sm font-black text-amber-200">Confirming deposit on Base…</p>
                  <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                    Waiting for your transaction to confirm. Keep this tab open — your Card ID and
                    Secret will appear here automatically.
                  </p>
                </div>
              )}
              {asset === "ETH" ? (
                <Transaction
                  chainId={base.id}
                  calls={prepareOnchainKitCalls(createEthCall)}
                  capabilities={txCaps}
                  onStatus={handleFundTx}
                >
                  <TransactionButton
                    className="w-full py-3.5 rounded-xl font-black bg-cyan-500 hover:bg-cyan-400 text-white"
                    text="Deposit"
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
              ) : needsUsdcApproval ? (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-amber-300 uppercase tracking-widest text-center">
                    Step 1 of 2 · Approve USDC
                  </p>
                  <Transaction
                    chainId={base.id}
                    calls={prepareOnchainKitCalls(approveUsdcCall)}
                    capabilities={txCaps}
                    onStatus={handleApproveTx}
                  >
                    <TransactionButton
                      className="w-full py-3.5 rounded-xl font-black btn-primary text-white"
                      text="Approve"
                    />
                  </Transaction>
                  <p className="text-[10px] text-slate-500 text-center">
                    After approval, tap Deposit to create your cards.
                  </p>
                </div>
              ) : usdcReadyToFund ? (
                <div className="space-y-3">
                  {usdcApproveCompleted && (
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest text-center">
                      Step 2 of 2 · Deposit
                    </p>
                  )}
                  <Transaction
                    chainId={base.id}
                    calls={prepareOnchainKitCalls(createUsdcCall)}
                    capabilities={txCaps}
                    onStatus={handleFundTx}
                  >
                    <TransactionButton
                      className="w-full py-3.5 rounded-xl font-black btn-primary text-white"
                      text="Deposit"
                    />
                  </Transaction>
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 rounded-xl font-black bg-white/10 text-slate-500"
                >
                  Preparing funding…
                </button>
              )}
            </div>
          )}

          {createdCards && (
            <div
              ref={createdSectionRef}
              className="border-2 border-emerald-400/40 bg-emerald-500/10 rounded-2xl p-4 sm:p-5 space-y-4 mt-4 scroll-mt-24"
            >
              {!createdCards.cards.some((c) => c.secret) && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                  <p className="text-sm font-black text-amber-200">Card ID only — secret not stored</p>
                  <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                    Your deposit is on Base (Batch #{createdCards.batchId}). The app failed to
                    save the secret when your deposit confirmed — this is not from clearing history.
                    If you still have the secret from a screenshot or copy, you can redeem manually.
                  </p>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 font-black text-base sm:text-lg">
                    <CheckCircle size={20} /> Your cards are ready!
                  </div>
                  <p className="text-sm text-white font-bold mt-1">Batch #{createdCards.batchId}</p>
                  <p className="text-xs text-cyan-300 font-bold mt-1">
                    {createdCards.cardCount} cards
                    {batchCardStatuses[createdCards.batchId]
                      ? ` · ${batchCardStatuses[createdCards.batchId].filter((c) => !c.redeemed).length} not redeemed yet`
                      : " · syncing redemption status…"}
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
                    redeemed={isCardRedeemed(c.cardId)}
                    statusLoading={
                      !isCardStatusKnown(c.cardId) &&
                      (mineStatusesLoading || loadingBatchDetail === createdCards.batchId)
                    }
                  />
                ))}
              </div>

              <VoucherSharePanel batch={createdCards} />
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

          {redeemError && !redeemPreview?.redeemed && (
            <p className="text-red-400 text-xs font-bold">{redeemError}</p>
          )}

          <RedeemStatusBanner
            cardId={redeemPreview?.cardId}
            redeemed={redeemPreview?.redeemed}
            loading={redeemPreviewLoading && !redeemPreview}
          />

          {(redeemParsedForTx || redeemPreview) && (
            <div className="relative min-h-[340px] rounded-2xl border border-cyan-500/20 bg-white/[0.02] overflow-hidden">
              {redeemPreviewLoading && !redeemPreview ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <RefreshCcw size={20} className="animate-spin text-cyan-400/70" />
                  <p className="text-sm font-bold">Loading card details…</p>
                </div>
              ) : redeemPreview ? (
                <div
                  className={`p-4 transition-opacity duration-200 ${
                    redeemPreviewRefreshing ? "opacity-60" : "opacity-100"
                  }`}
                >
                  {redeemPreviewRefreshing && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#020812]/40 backdrop-blur-[1px]">
                      <RefreshCcw size={18} className="animate-spin text-cyan-300" />
                    </div>
                  )}
                  <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-3">
                    {redeemPreview.redeemed ? "Card preview (redeemed)" : "Your gift card"}
                  </p>
                  <VoucherCardPreview
                    cardId={redeemPreview.cardId}
                    asset={redeemPreview.asset}
                    amount={redeemPreview.amountPerCard}
                    message={redeemPreview.message}
                    redeemed={redeemPreview.redeemed}
                    showSecret={false}
                    showRedeemedNotice={false}
                  />
                </div>
              ) : null}
            </div>
          )}

          <p className="text-[10px] text-slate-500">
            You can only redeem <span className="text-cyan-400 font-bold">one card</span> per batch per wallet.
          </p>

          {contractReady && redeemCall.length > 0 && !redeemPreview?.redeemed ? (
            <Transaction
              key={redeemKey}
              chainId={base.id}
              calls={prepareOnchainKitCalls(redeemCall)}
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
              className={`w-full py-3.5 rounded-xl font-black ${
                redeemPreview?.redeemed
                  ? "bg-red-500/15 border border-red-400/40 text-red-200"
                  : "bg-white/10 text-slate-600"
              }`}
            >
              {redeemPreviewLoading && !redeemPreview
                ? "Checking card…"
                : redeemPreview?.redeemed
                  ? "Already redeemed — cannot claim again"
                  : redeemParsedForTx && !redeemSecret.trim()
                    ? "Enter secret key"
                    : "Enter Card ID & Secret"}
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
                {viewedCard.redeemed && (
                  <p className="text-amber-300 text-xs font-bold flex items-center gap-1.5">
                    <AlertCircle size={14} /> This card has already been redeemed onchain.
                  </p>
                )}
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
          {address && (
            <SectionCard bar={false} className="border border-cyan-500/20">
              <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Your pay link</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Share this link so anyone can send you vouchers or explore x402 on Base.
              </p>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <code className="flex-1 text-[11px] font-mono text-cyan-300 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 truncate">
                  {buildPayLinkUrl(address)}
                </code>
                <button
                  type="button"
                  onClick={() => copyText(buildPayLinkUrl(address), "pay-link")}
                  className="flex items-center justify-center gap-2 text-sm font-black px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white hover:bg-white/15 shrink-0"
                >
                  {copied === "pay-link" ? <CheckCircle size={14} /> : <Copy size={14} />}
                  Copy link
                </button>
              </div>
            </SectionCard>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Your voucher batches</p>
            <div className="flex items-center gap-2">
              {mineStatusesLoading && (
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <RefreshCcw size={12} className="animate-spin" /> Syncing…
                </span>
              )}
              <button onClick={refreshMyBatches} className="text-slate-500 hover:text-cyan-400 p-1">
                <RefreshCcw size={14} />
              </button>
            </div>
          </div>

          {(connType === "coinbase" || connType === "farcaster") && (
            <SectionCard bar={false} className="border border-cyan-500/25 bg-cyan-500/5">
              <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                Base App deposit
              </p>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Deposits through Base App use a smart wallet bundle. If your batch
                doesn&apos;t appear right away, paste your deposit transaction hash
                below — we link it to your wallet automatically.
              </p>
              <div className="mt-3 space-y-2">
                <input
                  value={recoverTxInput}
                  onChange={(e) => setRecoverTxInput(e.target.value.trim())}
                  placeholder="0x… deposit tx hash"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono text-xs outline-none focus:border-cyan-500/40"
                />
                {recoverError && (
                  <p className="text-red-400 text-xs font-bold">{recoverError}</p>
                )}
                <button
                  type="button"
                  disabled={recoverLoading || !recoverTxInput}
                  onClick={() => void recoverBatchByTx(recoverTxInput)}
                  className="w-full py-2.5 rounded-xl text-xs font-black bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-40"
                >
                  {recoverLoading ? "Linking batch…" : "Link deposit to My Cards"}
                </button>
              </div>
            </SectionCard>
          )}

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
              <div className="py-6 text-center space-y-4">
                <CreditCard size={28} className="text-slate-600 mx-auto" />
                <p className="text-slate-400 text-sm font-bold">
                  No vouchers yet — or your deposit needs to be linked.
                </p>
                <div className="text-left max-w-md mx-auto space-y-2 pt-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Recover by deposit transaction hash
                  </label>
                  <input
                    value={recoverTxInput}
                    onChange={(e) => setRecoverTxInput(e.target.value.trim())}
                    placeholder="0x…"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-3 text-white font-mono text-xs outline-none focus:border-cyan-500/40"
                  />
                  {recoverError && (
                    <p className="text-red-400 text-xs font-bold">{recoverError}</p>
                  )}
                  <button
                    type="button"
                    disabled={recoverLoading || !recoverTxInput}
                    onClick={() => void recoverBatchByTx(recoverTxInput)}
                    className="w-full py-3 rounded-xl font-black btn-primary disabled:opacity-40"
                  >
                    {recoverLoading ? "Recovering…" : "Recover my batch"}
                  </button>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Paste the Base transaction hash from your wallet after depositing. Card
                    secrets only appear if this browser still has them saved.
                  </p>
                </div>
              </div>
            </SectionCard>
          ) : (
            myBatches.map((b) => {
              const redeemed = chainStats[b.batchId] ?? 0;
              const unredeemed = Math.max(0, b.cardCount - redeemed);
              const pct = Math.round((redeemed / b.cardCount) * 100);
              const cardStatuses = batchCardStatuses[b.batchId];
              const displayCards = displayCardsForBatch(b);
              const hasLocalSecrets = displayCards.some((c) => c.secret.length > 0);
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

                  <div className="mb-4 space-y-3">
                    <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                      Your card{displayCards.length === 1 ? "" : "s"}
                    </p>
                    {displayCards.map((c, i) => (
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
                        redeemed={isCardRedeemed(c.cardId)}
                        statusLoading={
                          !isCardStatusKnown(c.cardId) &&
                          (mineStatusesLoading || loadingBatchDetail === b.batchId)
                        }
                      />
                    ))}
                  </div>

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

                  {expandedBatchId === b.batchId && (
                    <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Redemption status
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(cardStatuses?.length ? cardStatuses : displayCards.map((c) => ({
                          cardId: c.cardId,
                          redeemed: isCardRedeemed(c.cardId),
                        }))).map((c) => (
                          <div
                            key={c.cardId}
                            className={`rounded-lg px-3 py-2.5 text-xs font-bold border ${
                              c.redeemed
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                            }`}
                          >
                            <span className="font-mono text-sm">{c.cardId}</span>
                            <p className="mt-0.5 text-[10px] uppercase tracking-wide opacity-80">
                              {c.redeemed ? "Redeemed" : "Available to redeem"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
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
        onCreateOwn={() => {
          setView("create");
          setTab("basehub");
        }}
        onClose={() => {
          setRedeemSuccess(null);
          setRedeemCardId("");
          setDebouncedRedeemCardId("");
          setRedeemSecret("");
          setRedeemPreview(null);
          redeemPreviewRef.current = null;
          setRedeemKey((k) => k + 1);
        }}
      />
    </div>
  );
}
