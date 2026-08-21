import {
  fetchBlockscoutInternalTxs,
  fetchBlockscoutNftTxs,
  fetchBlockscoutTokenTxs,
  fetchBlockscoutTxs,
} from "@/lib/api/blockscout";
import { fetchAlchemyWalletComplete } from "@/lib/api/alchemy";
import { fetchBasescanAllFast } from "@/lib/api/basescan";
import {
  fetchBlockscoutV2Activity,
  type V2StreamState,
} from "@/lib/api/blockscout-v2";
import {
  fetchUserOperationActivityFull,
  fetchUserOperationActivityWithProgress,
} from "@/lib/api/user-operations";
import {
  detectSmartAccount,
  collectionProfileForAccount,
} from "@/lib/wallet/smart-account";
import { getAlchemyKey } from "@/lib/constants/env";
import { mergeTransfers, rollupWalletActivity } from "@/lib/utils/wallet-activity";
import type { AlchemyTransfer } from "@/lib/types/wallet";

export interface WalletTxSources {
  alchemyOut: number;
  alchemyIn: number;
  blockscoutV1: number;
  blockscoutInternalV1: number;
  blockscoutTokenV1: number;
  blockscoutV2: number;
  userOperations: number;
  basescan: number;
  merged: number;
  uniqueHashes: number;
  uniqueDays: number;
}

export type WalletFetchDepth = "quick" | "recent" | "connect" | "complete";

export interface WalletFetchOptions {
  depth?: WalletFetchDepth;
  skipV2?: boolean;
  basescanKey?: string;
}

const CONNECT_V1_DEADLINE_MS = 14_000;

function resolveOptions(
  options: WalletFetchOptions | string = {}
): WalletFetchOptions {
  if (typeof options === "string") return { basescanKey: options };
  return options;
}

/**
 * Connect: v2 token stream (sequential) + v1 txlist — avoids Blockscout rate limits.
 * Complete: all sources, full v2 pagination for background sync.
 */
export async function fetchWalletTransfersMerged(
  address: string,
  options: WalletFetchOptions | string = {}
): Promise<{
  transfers: AlchemyTransfer[];
  sources: WalletTxSources;
  historyComplete: boolean;
  v2StreamStates: Record<string, V2StreamState>;
}> {
  const { depth = "connect", skipV2 = false } = resolveOptions(options);
  const addr = address.toLowerCase();
  const isComplete = depth === "complete";
  const smart = await detectSmartAccount(addr);
  const profile = collectionProfileForAccount(
    smart,
    isComplete ? "complete" : "connect"
  );

  const emptyV2States: Record<string, V2StreamState> = {
    "token-transfers": { complete: false, cursor: null },
    "internal-transactions": { complete: false, cursor: null },
    transactions: { complete: false, cursor: null },
  };

  if (isComplete) {
    const v2Opts = profile.v2;
    const v2FetchP = skipV2
      ? Promise.resolve({
          transfers: [] as AlchemyTransfer[],
          complete: false,
          streamStates: emptyV2States,
        })
      : fetchBlockscoutV2Activity(addr, v2Opts).catch(() => ({
          transfers: [] as AlchemyTransfer[],
          complete: false,
          streamStates: emptyV2States,
        }));

    const [
      blockscoutTxs,
      internalTxs,
      tokenTxs,
      nftTxs,
      blockscoutV2Result,
      userOps,
      basescanTxs,
    ] = await Promise.all([
      fetchBlockscoutTxs(addr, { deadlineMs: 0 }).catch(() => []),
      fetchBlockscoutInternalTxs(addr, { deadlineMs: 0 }).catch(() => []),
      fetchBlockscoutTokenTxs(addr, { deadlineMs: 0 }).catch(() => []),
      fetchBlockscoutNftTxs(addr, { deadlineMs: 0 }).catch(() => []),
      v2FetchP,
      fetchUserOperationActivityFull(addr).catch(() => []),
      fetchBasescanAllFast(addr, 45_000, 20).catch(() => []),
    ]);

    return buildResult(
      addr,
      [
        blockscoutTxs,
        tokenTxs,
        nftTxs,
        internalTxs,
        blockscoutV2Result.transfers,
        userOps,
        basescanTxs,
      ],
      {
        alchemyOut: 0,
        alchemyIn: 0,
        blockscoutV1: blockscoutTxs.length,
        blockscoutInternalV1: internalTxs.length,
        blockscoutTokenV1: tokenTxs.length,
        blockscoutV2: blockscoutV2Result.transfers.length,
        userOperations: userOps.length,
        basescan: basescanTxs.length,
      },
      blockscoutV2Result.complete,
      blockscoutV2Result.streamStates
    );
  }

  // Connect — Blockscout + AA userOps + Basescan (when API key present)
  const [
    v2Res,
    blockscoutTxs,
    internalTxs,
    tokenTxs,
    nftTxs,
    userOps,
    basescanTxs,
  ] = await Promise.all([
    skipV2
      ? Promise.resolve({
          transfers: [] as AlchemyTransfer[],
          complete: false,
          streamStates: emptyV2States,
        })
      : fetchBlockscoutV2Activity(addr, profile.v2).catch(() => ({
          transfers: [] as AlchemyTransfer[],
          complete: false,
          streamStates: emptyV2States,
        })),
    fetchBlockscoutTxs(addr, { deadlineMs: CONNECT_V1_DEADLINE_MS }).catch(
      () => []
    ),
    fetchBlockscoutInternalTxs(addr, {
      deadlineMs: smart.isSmartAccount ? 18_000 : 10_000,
      maxPages: smart.isSmartAccount ? 14 : 4,
    }).catch(() => []),
    fetchBlockscoutTokenTxs(addr, {
      deadlineMs: smart.isSmartAccount ? 18_000 : 10_000,
      maxPages: smart.isSmartAccount ? 16 : 5,
    }).catch(() => []),
    fetchBlockscoutNftTxs(addr, {
      deadlineMs: smart.isSmartAccount ? 12_000 : 8_000,
      maxPages: smart.isSmartAccount ? 6 : 3,
    }).catch(() => []),
    fetchUserOperationActivityWithProgress(addr, {
      timeoutMs: profile.userOps.timeoutMs,
      maxChunks: profile.userOps.maxChunks,
    })
      .then((r) => r.transfers)
      .catch(() => []),
    fetchBasescanAllFast(addr, 14_000, 6).catch(() => []),
  ]);

  return buildResult(
    addr,
    [
      blockscoutTxs,
      tokenTxs,
      nftTxs,
      internalTxs,
      v2Res.transfers,
      userOps,
      basescanTxs,
    ],
    {
      alchemyOut: 0,
      alchemyIn: 0,
      blockscoutV1: blockscoutTxs.length,
      blockscoutInternalV1: internalTxs.length,
      blockscoutTokenV1: tokenTxs.length,
      blockscoutV2: v2Res.transfers.length,
      userOperations: userOps.length,
      basescan: basescanTxs.length,
    },
    v2Res.complete,
    v2Res.streamStates
  );
}

function buildResult(
  addr: string,
  transferSets: AlchemyTransfer[][],
  counts: Omit<
    WalletTxSources,
    "merged" | "uniqueHashes" | "uniqueDays"
  >,
  historyComplete: boolean,
  v2StreamStates: Record<string, V2StreamState>,
  alchemy?: {
    alchemyOutComplete: boolean;
    alchemyInComplete: boolean;
    alchemyOutPageKey: string | null;
    alchemyInPageKey: string | null;
  }
) {
  const transfers = mergeTransfers(transferSets);
  const activity = rollupWalletActivity(transfers, addr);
  return {
    transfers,
    sources: {
      ...counts,
      merged: transfers.length,
      uniqueHashes: activity.participatingHashes.size,
      uniqueDays: activity.uDays.size,
    },
    historyComplete,
    v2StreamStates,
    alchemyOutComplete: alchemy?.alchemyOutComplete ?? false,
    alchemyInComplete: alchemy?.alchemyInComplete ?? false,
    alchemyOutPageKey: alchemy?.alchemyOutPageKey ?? null,
    alchemyInPageKey: alchemy?.alchemyInPageKey ?? null,
  };
}

export function mergeWalletTransferSets(
  base: AlchemyTransfer[],
  supplemental: AlchemyTransfer[]
): AlchemyTransfer[] {
  if (!supplemental.length) return base;
  return mergeTransfers([base, supplemental]);
}

const EMPTY_V2_STATES: Record<string, V2StreamState> = {
  "token-transfers": { complete: false, cursor: null },
  "internal-transactions": { complete: false, cursor: null },
  transactions: { complete: false, cursor: null },
};

/**
 * Paid first analyze — collect *this wallet only*, as completely as possible under a tight wall.
 *
 * Strategy:
 * 1. Alchemy from+to pagination until empty page (primary; address-filtered).
 * 2. EntryPoint UserOps for v0.6+v0.7 in parallel (AA / Base App).
 * 3. Light Blockscout/Basescan fill only as supplement (does not extend the wall).
 *
 * Background `/api/wallet-sync` finishes any remaining v2 cursors.
 */
export async function fetchWalletTransfersConnectRich(
  address: string
): Promise<{
  transfers: AlchemyTransfer[];
  sources: WalletTxSources;
  historyComplete: boolean;
  v2StreamStates: Record<string, V2StreamState>;
  alchemyOutComplete: boolean;
  alchemyInComplete: boolean;
  alchemyOutPageKey: string | null;
  alchemyInPageKey: string | null;
}> {
  const addr = address.toLowerCase();
  const hasAlchemy = Boolean(getAlchemyKey());
  /** Longer wall so high-activity wallets capture older Alchemy pages on first scan. */
  const PRIMARY_BUDGET_MS = 32_000;

  const alchemyP = hasAlchemy
    ? fetchAlchemyWalletComplete(addr, {
        budgetMs: PRIMARY_BUDGET_MS,
        maxPagesPerDirection: 120,
        pageTimeoutMs: 3_500,
      }).catch(() => ({
        transfers: [] as AlchemyTransfer[],
        outComplete: false,
        inComplete: false,
        outPageKey: null as string | null,
        inPageKey: null as string | null,
      }))
    : Promise.resolve({
        transfers: [] as AlchemyTransfer[],
        outComplete: false,
        inComplete: false,
        outPageKey: null as string | null,
        inPageKey: null as string | null,
      });

  const userOpsP = fetchUserOperationActivityWithProgress(addr, {
    timeoutMs: 14_000,
    maxChunks: 24,
  }).catch(() => ({
    transfers: [] as AlchemyTransfer[],
    chunksScanned: 0,
    complete: false,
  }));

  // Parallel fillers — more pages when Alchemy is on for day coverage.
  const v2P = fetchBlockscoutV2Activity(addr, {
    tokenPages: hasAlchemy ? 20 : 28,
    internalPages: hasAlchemy ? 12 : 18,
    externalPages: hasAlchemy ? 12 : 18,
    deadlineMs: hasAlchemy ? 14_000 : 16_000,
    pageTimeoutMs: 3_200,
  }).catch(() => ({
    transfers: [] as AlchemyTransfer[],
    complete: false,
    streamStates: EMPTY_V2_STATES,
  }));

  const basescanP = fetchBasescanAllFast(addr, 8_000, 4).catch(() => []);

  // Skip heavy v1 multi-endpoint crawl when Alchemy is on; only used as thin fallback.
  const fillV1P = hasAlchemy
    ? Promise.resolve({
        txs: [] as AlchemyTransfer[],
        internal: [] as AlchemyTransfer[],
        token: [] as AlchemyTransfer[],
        nft: [] as AlchemyTransfer[],
      })
    : Promise.all([
        fetchBlockscoutTxs(addr, { deadlineMs: 10_000, maxPages: 12 }).catch(
          () => []
        ),
        fetchBlockscoutInternalTxs(addr, {
          deadlineMs: 10_000,
          maxPages: 10,
        }).catch(() => []),
        fetchBlockscoutTokenTxs(addr, {
          deadlineMs: 10_000,
          maxPages: 12,
        }).catch(() => []),
        fetchBlockscoutNftTxs(addr, { deadlineMs: 6_000, maxPages: 4 }).catch(
          () => []
        ),
      ]).then(([txs, internal, token, nft]) => ({
        txs,
        internal,
        token,
        nft,
      }));

  const [alchemy, userOps, blockscoutV2, basescanTxs, v1] = await Promise.all([
    alchemyP,
    userOpsP,
    v2P,
    basescanP,
    fillV1P,
  ]);

  // Optional short fill only when Alchemy returned almost nothing (no extra wait on healthy wallets).
  let thinFill: AlchemyTransfer[] = [];
  if (hasAlchemy && alchemy.transfers.length < 25) {
    const [token, internal] = await Promise.all([
      fetchBlockscoutTokenTxs(addr, {
        deadlineMs: 6_000,
        maxPages: 8,
      }).catch(() => []),
      fetchBlockscoutInternalTxs(addr, {
        deadlineMs: 6_000,
        maxPages: 6,
      }).catch(() => []),
    ]);
    thinFill = mergeTransfers([token, internal]);
  }

  const alchemyDone = alchemy.outComplete && alchemy.inComplete;
  // Full history needs Alchemy + UserOps + Blockscout v2 — never soft-complete
  // after UserOps alone (that dropped heatmap days and token volume).
  const historyComplete = hasAlchemy
    ? alchemyDone && userOps.complete && blockscoutV2.complete
    : blockscoutV2.complete && userOps.complete;

  return buildResult(
    addr,
    [
      alchemy.transfers,
      v1.txs,
      v1.token,
      v1.nft,
      v1.internal,
      thinFill,
      blockscoutV2.transfers,
      userOps.transfers,
      basescanTxs,
    ],
    {
      alchemyOut: alchemy.transfers.filter(
        (t) => (t.from || "").toLowerCase() === addr
      ).length,
      alchemyIn: alchemy.transfers.filter(
        (t) => (t.to || "").toLowerCase() === addr
      ).length,
      blockscoutV1: v1.txs.length,
      blockscoutInternalV1: v1.internal.length + thinFill.length,
      blockscoutTokenV1: v1.token.length,
      blockscoutV2: blockscoutV2.transfers.length,
      userOperations: userOps.transfers.length,
      basescan: basescanTxs.length,
    },
    historyComplete,
    blockscoutV2.streamStates,
    {
      alchemyOutComplete: alchemy.outComplete,
      alchemyInComplete: alchemy.inComplete,
      alchemyOutPageKey: alchemy.outPageKey,
      alchemyInPageKey: alchemy.inPageKey,
    }
  );
}

/**
 * Fast first score — newest activity only (Alchemy returns desc).
 * Enough to show last tx, recent list, and a real score in ~8s.
 * Background wallet-sync resumes older Alchemy pages from the returned cursors.
 */
export async function fetchWalletTransfersRecent(
  address: string
): Promise<{
  transfers: AlchemyTransfer[];
  sources: WalletTxSources;
  historyComplete: boolean;
  v2StreamStates: Record<string, V2StreamState>;
  alchemyOutComplete: boolean;
  alchemyInComplete: boolean;
  alchemyOutPageKey: string | null;
  alchemyInPageKey: string | null;
}> {
  const addr = address.toLowerCase();
  const hasAlchemy = Boolean(getAlchemyKey());
  const PRIMARY_BUDGET_MS = 8_000;

  const alchemyP = hasAlchemy
    ? fetchAlchemyWalletComplete(addr, {
        budgetMs: PRIMARY_BUDGET_MS,
        maxPagesPerDirection: 8,
        pageTimeoutMs: 2_400,
      }).catch(() => ({
        transfers: [] as AlchemyTransfer[],
        outComplete: false,
        inComplete: false,
        outPageKey: null as string | null,
        inPageKey: null as string | null,
      }))
    : Promise.resolve({
        transfers: [] as AlchemyTransfer[],
        outComplete: false,
        inComplete: false,
        outPageKey: null as string | null,
        inPageKey: null as string | null,
      });

  const userOpsP = fetchUserOperationActivityWithProgress(addr, {
    timeoutMs: 6_000,
    maxChunks: 8,
  }).catch(() => ({
    transfers: [] as AlchemyTransfer[],
    chunksScanned: 0,
    complete: false,
  }));

  const v2P = fetchBlockscoutV2Activity(addr, {
    tokenPages: 6,
    internalPages: 4,
    externalPages: 4,
    deadlineMs: 6_000,
    pageTimeoutMs: 2_200,
  }).catch(() => ({
    transfers: [] as AlchemyTransfer[],
    complete: false,
    streamStates: EMPTY_V2_STATES,
  }));

  const basescanP = fetchBasescanAllFast(addr, 4_000, 2).catch(() => []);

  const [alchemy, userOps, blockscoutV2, basescanTxs] = await Promise.all([
    alchemyP,
    userOpsP,
    v2P,
    basescanP,
  ]);

  return buildResult(
    addr,
    [
      alchemy.transfers,
      blockscoutV2.transfers,
      userOps.transfers,
      basescanTxs,
    ],
    {
      alchemyOut: alchemy.transfers.filter(
        (t) => (t.from || "").toLowerCase() === addr
      ).length,
      alchemyIn: alchemy.transfers.filter(
        (t) => (t.to || "").toLowerCase() === addr
      ).length,
      blockscoutV1: 0,
      blockscoutInternalV1: 0,
      blockscoutTokenV1: 0,
      blockscoutV2: blockscoutV2.transfers.length,
      userOperations: userOps.transfers.length,
      basescan: basescanTxs.length,
    },
    false,
    blockscoutV2.streamStates,
    {
      alchemyOutComplete: alchemy.outComplete,
      alchemyInComplete: alchemy.inComplete,
      alchemyOutPageKey: alchemy.outPageKey,
      alchemyInPageKey: alchemy.inPageKey,
    }
  );
}
