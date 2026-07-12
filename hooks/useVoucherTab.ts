"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { encodeContractCall, prepareCallsForWalletSendCalls } from "@/lib/utils/tx";
import { base } from "viem/chains";
import { usePublicClient } from "wagmi";
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
  formatCardId,
  formatVoucherAmount,
  hashVoucherSecret,
  loadLocalBatches,
  loadAllLocalBatchesForDevice,
  loadPendingBatch,
  loadAnyPendingBatch,
  loadPendingBatchForTx,
  savePendingBatchForTx,
  clearPendingBatch,
  savePendingBatch,
  saveLastVoucherTx,
  loadLastVoucherTx,
  parseCardId,
  saveLocalBatch,
  mergeSecretsIntoBatch,
  tokenToAsset,
} from "@/lib/utils/voucher";
import { confirmVoucherBatchCreate, finalizePendingBatchFromTx, asConfirmClient } from "@/lib/voucher/confirm-create";
import {
  loadWalletCredentials,
  saveWalletCredentials,
  mergeServerSecrets,
} from "@/lib/voucher/credentials-client";
import {
  saveCreateSession,
  loadCreateSession,
  clearCreateSession,
  setSessionFundTx,
} from "@/lib/voucher/create-session";
import {
  getOnchainKitCapabilities,
  usesWalletSendCallsAttribution,
} from "@/lib/utils/paymaster";
import { bumpWeeklyTxKey } from "@/lib/utils/wallet-session";
import { recordConfirmedInAppAction } from "@/lib/utils/daily-points";
import { USDC_PRESETS, ETH_PRESETS } from "@/components/voucher/voucher-constants";
import type {
  VoucherView,
  ViewedCard,
  RedeemPreview,
  RedeemSuccess,
} from "@/components/voucher/voucher-types";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { txHashFromLifecycle } from "@/lib/utils/tx-status";
import type { LifecycleStatus } from "@coinbase/onchainkit/transaction";
import { APP_URL_WEB } from "@/lib/constants/env";

export function useVoucherTab(app: WalletAppState) {
  const { showToast, setSponsored, setTab, wallet, setTxKeys, connType, setPointsRevision } = app;
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
  const fundTxRef = useRef<string | undefined>(undefined);

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
  const [cardsReadyGate, setCardsReadyGate] = useState<StoredVoucherBatch | null>(null);

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
        cards?: StoredVoucherBatch["cards"];
      }
    ) => {
      const existing = merged.get(b.batchId);
      const incoming = b.cards;
      const incomingHasSecrets = incoming?.some((c) => c.secret?.trim());
      const existingHasSecrets = existing?.cards.some((c) => c.secret?.trim());

      let cards: StoredVoucherBatch["cards"];
      const secretFrom = (
        list: StoredVoucherBatch["cards"] | undefined,
        cardIndex: number
      ) => list?.find((c) => c.cardIndex === cardIndex)?.secret?.trim() || "";

      if (existingHasSecrets && incomingHasSecrets) {
        cards = existing!.cards.map((c) => ({
          ...c,
          secret: c.secret?.trim() || secretFrom(incoming, c.cardIndex),
        }));
      } else if (existingHasSecrets) {
        cards = existing!.cards;
      } else if (incomingHasSecrets) {
        cards = incoming!;
      } else {
        cards = Array.from({ length: b.cardCount }, (_, i) => ({
          batchId: b.batchId,
          cardIndex: i,
          cardId: formatCardId(b.batchId, i),
          secret:
            secretFrom(existing?.cards, i) ||
            secretFrom(incoming, i),
        }));
      }

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
        cards,
      });
    },
    []
  );

  const refreshMyBatches = useCallback(async () => {
    if (!address) return;
    const local = loadAllLocalBatchesForDevice(address);
    const merged = new Map(local.map((b) => [b.batchId, b]));
    const stats: Record<number, number> = {};

    let serverCredentials: StoredVoucherBatch[] = [];
    try {
      serverCredentials = await loadWalletCredentials(address);
      for (const sb of serverCredentials) {
        if (sb.creator?.toLowerCase() !== address.toLowerCase()) continue;
        upsertBatchInMap(merged, { ...sb, creator: address });
      }
    } catch {
      /* server credentials optional */
    }

    // Migrate any local secrets to server (e.g. batch 11 saved before server storage existed).
    for (const b of merged.values()) {
      if (b.cards.some((c) => c.secret?.trim())) {
        void saveWalletCredentials(address, b);
      }
    }

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
          if (b.creator?.toLowerCase() !== address.toLowerCase()) continue;
          stats[b.batchId] = b.redeemedCount;
          upsertBatchInMap(merged, b);
        }
        setChainStats(stats);

        const withSecrets = [...merged.values()].map((b) => {
          const withServer = mergeServerSecrets(b, serverCredentials);
          const mergedBatch = mergeSecretsIntoBatch(withServer);
          if (
            address &&
            mergedBatch.cards.some((c) => c.secret.length > 0) &&
            !b.cards.some((c) => c.secret.length > 0)
          ) {
            saveLocalBatch(address, mergedBatch);
            void saveWalletCredentials(address, mergedBatch);
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
      const withSecrets = [...merged.values()].map((b) =>
        mergeSecretsIntoBatch(mergeServerSecrets(b, serverCredentials))
      );
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
      const withServer = mergeServerSecrets(b, serverCredentials);
      const mergedBatch = mergeSecretsIntoBatch(withServer);
      if (
        address &&
        mergedBatch.cards.some((c) => c.secret.length > 0) &&
        !b.cards.some((c) => c.secret.length > 0)
      ) {
        saveLocalBatch(address, mergedBatch);
        void saveWalletCredentials(address, mergedBatch);
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
    if (!address || !createdCards || createdCards.cards.some((c) => c.secret)) return;
    void (async () => {
      const server = await loadWalletCredentials(address);
      const match = server.find((b) => b.batchId === createdCards.batchId);
      if (match?.cards.some((c) => c.secret)) {
        setCreatedCards(mergeServerSecrets(createdCards, server));
      }
    })();
  }, [address, createdCards]);

  useEffect(() => {
    if (view !== "mine" || expandedBatchId === null) return;
    setMineStatusesLoading(true);
    void loadBatchDetail(expandedBatchId).finally(() => setMineStatusesLoading(false));
  }, [view, expandedBatchId, loadBatchDetail]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const shareText = async (text: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Base Voucher — gift card on Base", text, url: APP_URL_WEB });
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
    if (!address || !contractReady) return;
    setCreating(true);
    setCreatedCards(null);
    try {
      if (cardCount < 1 || cardCount > MAX_VOUCHER_CARDS) {
        alert(`Card count must be 1–${MAX_VOUCHER_CARDS}.`);
        return;
      }

      const res = await fetch("/api/voucher/prepare-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset,
          total: totalAmount,
          cards: cardCount,
          message: message.trim(),
          creator: address,
        }),
      });

      const result = (await res.json()) as {
        valid?: boolean;
        error?: string;
        asset?: VoucherAsset;
        expectedBatchId?: number;
        perCard?: string;
        totalAmount?: string;
        totalInput?: string;
        cardCount?: number;
        credentialsSaved?: boolean;
        cards?: Array<{
          cardId: string;
          cardIndex: number;
          secret: string;
        }>;
      };

      if (!res.ok || !result.valid || !result.expectedBatchId || !result.cards?.length) {
        alert(result.error || "Could not prepare voucher batch. Check contract connection.");
        return;
      }

      const totalWei = BigInt(result.totalAmount ?? "0");
      const perCardWei = BigInt(result.perCard ?? "0");
      if (totalWei <= BigInt(0) || perCardWei <= BigInt(0)) {
        alert("Invalid deposit amount from server. Please try again.");
        return;
      }

      const batchAsset = result.asset === "ETH" || result.asset === "USDC" ? result.asset : asset;

      if (!result.credentialsSaved) {
        console.warn("[BaseVoucher] Server did not confirm credential save — retrying");
        void saveWalletCredentials(address, {
          batchId: result.expectedBatchId,
          asset: batchAsset,
          totalAmount: totalWei.toString(),
          amountPerCard: perCardWei.toString(),
          cardCount: result.cardCount ?? cardCount,
          message: message.trim(),
          creator: address,
          createdAt: Date.now(),
          cards: result.cards.map((c) => ({
            batchId: result.expectedBatchId!,
            cardIndex: c.cardIndex,
            secret: c.secret,
            cardId: c.cardId,
          })),
        });
      }

      if (batchAsset !== asset) {
        setAsset(batchAsset);
      }

      const cards = result.cards.map((c) => ({
        batchId: result.expectedBatchId!,
        cardIndex: c.cardIndex,
        secret: c.secret,
        cardId: c.cardId,
      }));

      const batch: StoredVoucherBatch = {
        batchId: result.expectedBatchId,
        asset: batchAsset,
        totalAmount: totalWei.toString(),
        amountPerCard: perCardWei.toString(),
        cardCount: result.cardCount ?? cardCount,
        message: message.trim(),
        creator: address,
        createdAt: Date.now(),
        cards,
      };

      setPendingCards(batch);
      pendingBatchRef.current = batch;
      savePendingBatch(address, batch);
      saveCreateSession(address, { batchId: batch.batchId, startedAt: Date.now() });
      fundTxRef.current = undefined;
      createHandledRef.current = false;
      setUsdcApproveCompleted(false);
      setUsdcTxKey(0);
      notifiedTxRef.current = "";
    } catch (e) {
      console.error(e);
      alert("Could not prepare voucher batch. Check contract connection.");
    } finally {
      setCreating(false);
    }
  };

  const pendingHashes = useMemo((): `0x${string}`[] => {
    if (!pendingCards?.cards.length) return [];
    return pendingCards.cards.map((c) => hashVoucherSecret(c.secret));
  }, [pendingCards]);

  const pendingTotal = useMemo(() => {
    if (!pendingCards) return BigInt(0);
    return BigInt(pendingCards.totalAmount);
  }, [pendingCards]);

  /** Only show completed batch on Create tab — never while a new deposit is in progress. */
  const readyBatchOnCreate = pendingCards ? null : createdCards;
  const pendingAsset = pendingCards?.asset ?? asset;
  const [usdcAllowance, setUsdcAllowance] = useState<bigint | null>(null);
  const [checkingAllowance, setCheckingAllowance] = useState(false);
  const [usdcApproveCompleted, setUsdcApproveCompleted] = useState(false);
  const [usdcTxKey, setUsdcTxKey] = useState(0);

  const cancelPendingCreate = useCallback(() => {
    if (!address) return;
    setPendingCards(null);
    pendingBatchRef.current = null;
    clearPendingBatch(address);
    clearCreateSession(address);
    fundTxRef.current = undefined;
    createHandledRef.current = false;
      setUsdcApproveCompleted(false);
      setUsdcTxKey(0);
      setConfirmingDeposit(false);
  }, [address]);

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
    if (!address || !pendingCards || pendingAsset !== "USDC" || !publicClient) {
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
  }, [address, pendingCards, pendingAsset, publicClient, pendingTotal]);

  const createEthCall = useMemo(() => {
    if (!pendingCards || !contractReady || pendingAsset !== "ETH") return [];
    return [
      encodeContractCall(
        VOUCHER_CONTRACT as `0x${string}`,
        VOUCHER_ABI,
        "createEthBatch",
        [BigInt(pendingCards.cardCount), pendingHashes, pendingCards.message.trim()],
        pendingTotal
      ),
    ];
  }, [pendingCards, contractReady, pendingAsset, pendingHashes, pendingTotal]);

  const approveUsdcCall = useMemo(() => {
    if (!pendingCards || !contractReady || pendingAsset !== "USDC") return [];
    return [
      encodeContractCall(USDC_BASE as `0x${string}`, ERC20_ABI, "approve", [
        VOUCHER_CONTRACT as `0x${string}`,
        pendingTotal,
      ]),
    ];
  }, [pendingCards, contractReady, pendingAsset, pendingTotal]);

  const createUsdcCall = useMemo(() => {
    if (!pendingCards || !contractReady || pendingAsset !== "USDC") return [];
    return [
      encodeContractCall(VOUCHER_CONTRACT as `0x${string}`, VOUCHER_ABI, "createUsdcBatch", [
        BigInt(pendingCards.cardCount),
        pendingHashes,
        pendingCards.message.trim(),
        pendingTotal,
      ]),
    ];
  }, [pendingCards, contractReady, pendingAsset, pendingHashes, pendingTotal]);

  const usdcAllowanceError =
    pendingAsset === "USDC" && usdcAllowance === null && !checkingAllowance;

  const needsUsdcApproval =
    usdcAllowance !== null &&
    usdcAllowance < pendingTotal &&
    !usdcApproveCompleted;

  const usdcReadyToFund =
    pendingAsset !== "USDC" ||
    usdcApproveCompleted ||
    (usdcAllowance !== null && usdcAllowance >= pendingTotal);

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
      if (!address) return loadAnyPendingBatch(undefined, txHash);
      return (
        (txHash ? loadPendingBatchForTx(txHash) : null) ??
        pendingCards ??
        pendingBatchRef.current ??
        loadPendingBatch(address) ??
        loadAnyPendingBatch(address, txHash)
      );
    },
    [address, pendingCards]
  );

  const finalizeCreatedBatch = useCallback(
    async (batch: StoredVoucherBatch, txHash?: string) => {
      if (!address) return false;

      const pending = resolvePendingBatch(txHash);
      const cardsWithSecrets = batch.cards.map((c) => ({
        ...c,
        secret:
          pending?.cards.find((p) => p.cardIndex === c.cardIndex)?.secret ??
          c.secret,
      }));
      const hasSecrets = cardsWithSecrets.some((c) => c.secret.length > 0);

      const saved = {
        ...batch,
        creator: address,
        txHash,
        cards: cardsWithSecrets,
      };
      saveLocalBatch(address, saved);
      void saveWalletCredentials(address, saved);
      const nextKeys = bumpWeeklyTxKey(address, "voucher");
      setTxKeys((k) => ({ ...k, ...nextKeys }));
      recordConfirmedInAppAction(address, "voucher", nextKeys.voucher ?? 0);
      clearPendingBatch(address, txHash);
      clearCreateSession(address);
      fundTxRef.current = undefined;
      if (txHash) saveLastVoucherTx(address, txHash);
      setCreatedCards(saved);
      setPendingCards(null);
      pendingBatchRef.current = null;
      setExpandedBatchId(saved.batchId);
      setView("create");
      setConfirmingDeposit(false);
      if (hasSecrets) {
        setCardsReadyGate(saved);
      }

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
    [address, refreshMyBatches, resolvePendingBatch, setTxKeys, showToast]
  );

  const tryShowCardsWithSecrets = useCallback(
    async (txHash?: string): Promise<boolean> => {
      if (!address || !publicClient || createHandledRef.current || confirmingCreateRef.current) {
        return false;
      }

      const pending = resolvePendingBatch(txHash);
      if (!pending) return false;

      const session = address ? loadCreateSession(address) : null;
      if (session && pending.batchId !== session.batchId) return false;

      confirmingCreateRef.current = true;
      if (txHash) setConfirmingDeposit(true);
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
    if (!address || !publicClient || !contractReady || pendingCards) return;

    const session = loadCreateSession(address);
    const stored = loadPendingBatch(address) ?? loadAnyPendingBatch(address, session?.fundTxHash);
    if (!stored) return;
    if (session && stored.batchId !== session.batchId) return;

    pendingBatchRef.current = stored;
    fundTxRef.current = session?.fundTxHash;
    setPendingCards(stored);
  }, [address, publicClient, contractReady, pendingCards]);

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
        void saveWalletCredentials(address, placeholder);
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
      const pending = loadAnyPendingBatch(address, lastTx);
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
        "✅ USDC approved — now tap Deposit to create your cards",
        txHashFromLifecycle(status)
      );
      setUsdcApproveCompleted(true);
      setUsdcTxKey((k) => k + 1);
      void refreshUsdcAllowance();
      window.setTimeout(() => void refreshUsdcAllowance(), 2500);
    },
    [notifyVoucherTx, refreshUsdcAllowance]
  );

  useEffect(() => {
    if (!pendingCards || !address || !publicClient || createHandledRef.current) {
      return;
    }

    const fundTx = fundTxRef.current ?? loadCreateSession(address)?.fundTxHash;
    if (!fundTx) return;

    let attempts = 0;
    const maxAttempts = 30;

    const interval = window.setInterval(() => {
      if (createHandledRef.current || attempts >= maxAttempts) return;
      attempts += 1;
      void onCreateSuccess(fundTx);
    }, 8_000);

    return () => window.clearInterval(interval);
  }, [pendingCards, address, publicClient, onCreateSuccess]);

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
        if (address) {
          void saveWalletCredentials(address, pending);
          setSessionFundTx(address, hash);
        }
        fundTxRef.current = hash;
      }
      if (hash && address) saveLastVoucherTx(address, hash);
      setConfirmingDeposit(true);
      void (async () => {
        const ok = await onCreateSuccess(hash || undefined);
        if (ok) {
          notifyVoucherTx(
            `✅ ${pending?.cardCount ?? cardCount} voucher cards ready!`,
            hash
          );
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
      if (status.statusName !== "success") {
        return;
      }

      const hash = txHashFromLifecycle(status);
      notifyVoucherTx(
        "Card redeemed to your wallet!",
        hash,
        redeemNotifiedRef
      );

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
        const nextKeys = bumpWeeklyTxKey(wallet.address, "redeem");
        setTxKeys((k) => ({ ...k, ...nextKeys }));
        const { credited } = recordConfirmedInAppAction(
          wallet.address,
          "redeem",
          nextKeys.redeem ?? 0
        );
        setPointsRevision((n) => n + 1);
        void credited;
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

  const exactDepositLabel = formatVoucherAmount(pendingAsset, pendingTotal);

  return {
    shared: {
      contractReady,
      view,
      setView,
      address,
      connType,
      copied,
      copyText,
      shareText,
      txCaps,
      prepareOnchainKitCalls,
    },
    create: {
      asset,
      setAsset,
      totalAmount,
      setTotalAmount,
      cardCountInput,
      setCardCountInput,
      message,
      setMessage,
      creating,
      pendingCards,
      readyBatchOnCreate,
      activePresets,
      activePresetKey,
      split,
      perCardWei,
      cardCount,
      prepareCreate,
      cancelPendingCreate,
      pendingAsset,
      exactDepositLabel,
      needsUsdcApproval,
      confirmingDeposit,
      createEthCall,
      approveUsdcCall,
      createUsdcCall,
      checkingAllowance,
      usdcAllowanceError,
      usdcReadyToFund,
      usdcTxKey,
      refreshUsdcAllowance,
      handleApproveTx,
      handleFundTx,
      createdSectionRef,
      displayCardsForBatch,
      batchCardStatuses,
      isCardRedeemed,
      isCardStatusKnown,
      mineStatusesLoading,
      loadingBatchDetail,
    },
    redeem: {
      redeemCardId,
      setRedeemCardId,
      redeemSecret,
      setRedeemSecret,
      redeemError,
      redeemKey,
      redeemPreview,
      redeemPreviewLoading,
      redeemPreviewRefreshing,
      redeemParsedForTx,
      redeemCall,
      handleRedeemTx,
    },
    viewLookup: {
      viewCardId,
      setViewCardId,
      viewSecret,
      setViewSecret,
      viewLoading,
      viewError,
      viewedCard,
      lookupCard,
    },
    mine: {
      myBatches,
      chainStats,
      batchCardStatuses,
      creatorSummary,
      expandedBatchId,
      setExpandedBatchId,
      loadingBatchDetail,
      mineStatusesLoading,
      recoverTxInput,
      setRecoverTxInput,
      recoverLoading,
      recoverError,
      recoverBatchByTx,
      refreshMyBatches,
      loadBatchDetail,
      displayCardsForBatch,
      isCardRedeemed,
      isCardStatusKnown,
    },
    modals: {
      cardsReadyGate,
      setCardsReadyGate,
      redeemSuccess,
      setRedeemSuccess,
      setDebouncedRedeemCardId,
      setRedeemPreview,
      redeemPreviewRef,
      setRedeemKey,
      setTab,
    },
  };
}

export type VoucherTabState = ReturnType<typeof useVoucherTab>;
