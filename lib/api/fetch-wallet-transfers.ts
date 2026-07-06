import {
  fetchBlockscoutInternalTxs,
  fetchBlockscoutNftTxs,
  fetchBlockscoutTokenTxs,
  fetchBlockscoutTxs,
} from "@/lib/api/blockscout";
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

export type WalletFetchDepth = "quick" | "connect" | "complete";

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
    ] = await Promise.all([
      fetchBlockscoutTxs(addr, { deadlineMs: 0 }).catch(() => []),
      fetchBlockscoutInternalTxs(addr, { deadlineMs: 0 }).catch(() => []),
      fetchBlockscoutTokenTxs(addr, { deadlineMs: 0 }).catch(() => []),
      fetchBlockscoutNftTxs(addr, { deadlineMs: 0 }).catch(() => []),
      v2FetchP,
      fetchUserOperationActivityFull(addr).catch(() => []),
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
      ],
      {
        alchemyOut: 0,
        alchemyIn: 0,
        blockscoutV1: blockscoutTxs.length,
        blockscoutInternalV1: internalTxs.length,
        blockscoutTokenV1: tokenTxs.length,
        blockscoutV2: blockscoutV2Result.transfers.length,
        userOperations: userOps.length,
        basescan: 0,
      },
      blockscoutV2Result.complete,
      blockscoutV2Result.streamStates
    );
  }

  // Connect — Blockscout only
  const [
    v2Res,
    blockscoutTxs,
    internalTxs,
    tokenTxs,
    nftTxs,
    userOps,
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
    ],
    {
      alchemyOut: 0,
      alchemyIn: 0,
      blockscoutV1: blockscoutTxs.length,
      blockscoutInternalV1: internalTxs.length,
      blockscoutTokenV1: tokenTxs.length,
      blockscoutV2: v2Res.transfers.length,
      userOperations: userOps.length,
      basescan: 0,
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
  v2StreamStates: Record<string, V2StreamState>
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
  };
}

export function mergeWalletTransferSets(
  base: AlchemyTransfer[],
  supplemental: AlchemyTransfer[]
): AlchemyTransfer[] {
  if (!supplemental.length) return base;
  return mergeTransfers([base, supplemental]);
}
