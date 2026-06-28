import {
  fetchAlchemyTxsFast,
  fetchAlchemyTxsIncoming,
} from "@/lib/api/alchemy";
import { fetchBlockscoutV2Activity } from "@/lib/api/blockscout-v2";
import { fetchBasescanTxs } from "@/lib/api/basescan";
import {
  FETCH_LIMITS,
  type FetchMode,
} from "@/lib/api/fetch-limits";
import { mergeTransfers } from "@/lib/utils/wallet-activity";
import type { AlchemyTransfer } from "@/lib/types/wallet";

export interface WalletTxSources {
  alchemyOut: number;
  alchemyIn: number;
  basescan: number;
  blockscoutV2: number;
  merged: number;
  mode: FetchMode;
}

/** Server-side merge of wallet activity (fast = dashboard in ~5s, full = complete history). */
export async function fetchWalletTransfersMerged(
  address: string,
  basescanKey = "",
  mode: FetchMode = "full"
): Promise<{ transfers: AlchemyTransfer[]; sources: WalletTxSources }> {
  const limits = FETCH_LIMITS[mode];

  const blockscoutP = fetchBlockscoutV2Activity(address, {
    tokenPages: limits.blockscoutTokenPages,
    internalPages: limits.blockscoutInternalPages,
    externalPages: limits.blockscoutExternalPages,
    deadlineMs: limits.blockscoutDeadlineMs,
  }).catch(() => []);

  const alchemyOutP = fetchAlchemyTxsFast(
    address,
    limits.alchemyMaxPages
  ).catch(() => []);

  const alchemyInP = fetchAlchemyTxsIncoming(
    address,
    limits.alchemyMaxPages
  ).catch(() => []);

  const basescanP = limits.includeBasescan
    ? fetchBasescanTxs(address, basescanKey).catch(() => [])
    : Promise.resolve([] as AlchemyTransfer[]);

  const [alchemyOut, alchemyIn, basescanTxs, blockscoutV2] = await Promise.all([
    alchemyOutP,
    alchemyInP,
    basescanP,
    blockscoutP,
  ]);

  const transfers = mergeTransfers([
    blockscoutV2,
    alchemyOut,
    alchemyIn,
    basescanTxs,
  ]);

  return {
    transfers,
    sources: {
      alchemyOut: alchemyOut.length,
      alchemyIn: alchemyIn.length,
      basescan: basescanTxs.length,
      blockscoutV2: blockscoutV2.length,
      merged: transfers.length,
      mode,
    },
  };
}
