import {
  fetchBlockscoutInternalTxs,
  fetchBlockscoutTokenTxs,
  fetchBlockscoutTxs,
} from "@/lib/api/blockscout";
import {
  fetchAlchemyTxsMultiKey,
} from "@/lib/api/alchemy";
import { fetchBasescanAllFast } from "@/lib/api/basescan";
import {
  fetchUserOperationActivityWithProgress,
} from "@/lib/api/user-operations";
import {
  detectSmartAccount,
  collectionProfileForAccount,
  QUICK_SMART_PROFILE,
  type WalletCollectionProfile,
} from "@/lib/wallet/smart-account";
import {
  fetchBlockscoutV2Activity,
  V2_STREAMS,
  type V2Stream,
  type V2StreamState,
} from "@/lib/api/blockscout-v2";
import { getAlchemyKeys } from "@/lib/constants/env";
import {
  enrichTransferLegs,
  mergeTransfers,
  rollupWalletActivity,
} from "@/lib/utils/wallet-activity";
import type { AlchemyTransfer } from "@/lib/types/wallet";
import { fetchWalletTransfersMerged } from "@/lib/api/fetch-wallet-transfers";
import { collectWalletSupplements } from "@/lib/wallet/collect-supplements";

export interface CollectResult {
  transfers: AlchemyTransfer[];
  v2StreamStates: Record<string, V2StreamState>;
  historyComplete: boolean;
  userOpsFetched: boolean;
  v1SupplementFetched: boolean;
}

const EMPTY_STATES: Record<string, V2StreamState> = {
  "token-transfers": { complete: false, cursor: null },
  "internal-transactions": { complete: false, cursor: null },
  transactions: { complete: false, cursor: null },
};

// Fast connect path — tight deadlines; full history finishes in background sync.
const FAST_DEADLINE_MS = 6_000;
const FAST_PAGE_TIMEOUT_MS = 4_500;

/**
 * Parallel connect fetch — per-source deadlines only (no global cap that drops data).
 */
export async function collectWalletFastParallel(
  address: string
): Promise<CollectResult> {
  return collectWalletFastParallelInner(address);
}

async function collectWalletFastParallelInner(
  address: string
): Promise<CollectResult> {
  const addr = address.toLowerCase();
  const profile = QUICK_SMART_PROFILE;
  const alchemyKeys = getAlchemyKeys();
  const hasAlchemy = alchemyKeys.length > 0;
  const alchemyPages = hasAlchemy
    ? alchemyKeys.length >= 3
      ? 4
      : alchemyKeys.length >= 2
        ? 3
        : 2
    : 0;

  const [
    v2,
    v1Txs,
    v1Internal,
    v1Token,
    alchemyTxs,
    basescanTxs,
    userOpResult,
  ] = await Promise.all([
    fetchBlockscoutV2Activity(addr, {
      ...profile.v2,
      deadlineMs: FAST_DEADLINE_MS,
      pageTimeoutMs: FAST_PAGE_TIMEOUT_MS,
      sequentialStreams: false,
    }).catch(() => ({
      transfers: [] as AlchemyTransfer[],
      complete: false,
      streamStates: EMPTY_STATES,
    })),
    fetchBlockscoutTxs(addr, {
      deadlineMs: FAST_DEADLINE_MS,
      maxPages: hasAlchemy ? 1 : 2,
      pageTimeoutMs: FAST_PAGE_TIMEOUT_MS,
    }).catch(() => []),
    fetchBlockscoutInternalTxs(addr, {
      deadlineMs: FAST_DEADLINE_MS,
      maxPages: hasAlchemy ? 2 : 3,
      pageTimeoutMs: FAST_PAGE_TIMEOUT_MS,
    }).catch(() => []),
    fetchBlockscoutTokenTxs(addr, {
      deadlineMs: FAST_DEADLINE_MS,
      maxPages: hasAlchemy ? 2 : 4,
      pageTimeoutMs: FAST_PAGE_TIMEOUT_MS,
    }).catch(() => []),
    hasAlchemy
      ? fetchAlchemyTxsMultiKey(addr, {
          maxPagesPerShard: alchemyPages,
          timeoutMs: 4_500,
        }).catch(() => [] as AlchemyTransfer[])
      : Promise.resolve([] as AlchemyTransfer[]),
    hasAlchemy
      ? Promise.resolve([] as AlchemyTransfer[])
      : fetchBasescanAllFast(addr, FAST_DEADLINE_MS, 1).catch(() => []),
    fetchUserOperationActivityWithProgress(addr, {
      timeoutMs: 3_000,
      maxChunks: 4,
      startChunk: 0,
    }).catch(() => ({
      transfers: [] as AlchemyTransfer[],
      chunksScanned: 0,
      complete: false,
    })),
  ]);

  const transfers = enrichTransferLegs(
    mergeTransfers([
      v1Txs,
      v1Internal,
      v1Token,
      v2.transfers,
      alchemyTxs,
      basescanTxs,
      userOpResult.transfers,
    ]),
    addr
  );

  return {
    transfers,
    v2StreamStates: v2.streamStates,
    historyComplete: false,
    userOpsFetched: userOpResult.complete,
    v1SupplementFetched: false,
  };
}

/** Blockscout-only fallback (no Alchemy/Basescan keys). */
async function collectWalletBlockscout(
  address: string,
  profile: WalletCollectionProfile,
  opts: { v1TokenPages?: number } = {}
): Promise<CollectResult> {
  const addr = address.toLowerCase();
  const deadline = profile.v2.deadlineMs;
  const tokenPages = opts.v1TokenPages ?? profile.v2.tokenPages + 4;

  const [v2, v1Internal, v1Token, userOpResult] = await Promise.all([
    fetchBlockscoutV2Activity(addr, {
      ...profile.v2,
      sequentialStreams: false,
    }).catch(() => ({
      transfers: [] as AlchemyTransfer[],
      complete: false,
      streamStates: EMPTY_STATES,
    })),
    fetchBlockscoutInternalTxs(addr, {
      deadlineMs: deadline,
      maxPages: profile.v2.internalPages,
    }).catch(() => []),
    fetchBlockscoutTokenTxs(addr, {
      deadlineMs: deadline,
      maxPages: tokenPages,
    }).catch(() => []),
    fetchUserOperationActivityWithProgress(addr, {
      timeoutMs: profile.userOps.timeoutMs,
      maxChunks: profile.userOps.maxChunks,
      startChunk: 0,
    }).catch(() => ({
      transfers: [] as AlchemyTransfer[],
      chunksScanned: 0,
      complete: false,
    })),
  ]);

  const transfers = enrichTransferLegs(
    mergeTransfers([v1Internal, v1Token, v2.transfers, userOpResult.transfers]),
    addr
  );

  return {
    transfers,
    v2StreamStates: v2.streamStates,
    historyComplete: v2.complete,
    userOpsFetched: userOpResult.complete,
    v1SupplementFetched: false,
  };
}

/** Connect — parallel multi-API (~10–14s). Full history finishes in background sync. */
export async function collectWalletQuick(
  address: string
): Promise<CollectResult> {
  return collectWalletFastParallel(address);
}

export async function collectWalletFastAll(
  address: string
): Promise<CollectResult> {
  const smart = await detectSmartAccount(address.toLowerCase());
  const profile = collectionProfileForAccount(smart, "connect");
  return collectWalletFastParallel(address).then(async (fast) => {
    if (fast.transfers.length > 500) return fast;
    const extra = await collectWalletBlockscout(address, profile, {
      v1TokenPages: 20,
    });
    return {
      ...extra,
      transfers: enrichTransferLegs(
        mergeTransfers([fast.transfers, extra.transfers]),
        address.toLowerCase()
      ),
    };
  });
}

export async function collectWalletConnect(
  address: string
): Promise<CollectResult> {
  return collectWalletFastAll(address);
}

export async function collectWalletPreview(
  address: string
): Promise<CollectResult> {
  return collectWalletQuick(address);
}

export async function collectWalletComplete(
  address: string
): Promise<CollectResult> {
  const result = await fetchWalletTransfersMerged(address, { depth: "complete" });
  const transfers = enrichTransferLegs(result.transfers, address.toLowerCase());
  return {
    transfers,
    v2StreamStates: result.v2StreamStates,
    historyComplete: result.historyComplete,
    userOpsFetched: true,
    v1SupplementFetched: true,
  };
}

export async function collectWalletBootstrap(
  address: string
): Promise<CollectResult> {
  return collectWalletFastAll(address);
}

export async function collectWalletHistoryQuick(
  address: string
): Promise<CollectResult> {
  return collectWalletFastAll(address);
}

export { collectWalletSupplements, V2_STREAMS, type V2Stream };

export function summarizeTransfers(
  transfers: AlchemyTransfer[],
  address: string
): { uniqueDays: number; uniqueHashes: number } {
  const activity = rollupWalletActivity(transfers, address);
  return {
    uniqueDays: activity.uDays.size,
    uniqueHashes: activity.participatingHashes.size,
  };
}
