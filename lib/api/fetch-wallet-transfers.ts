import {
  fetchAlchemyTxsFast,
  fetchAlchemyTxsIncoming,
} from "@/lib/api/alchemy";
import {
  fetchBlockscoutInternalTxs,
  fetchBlockscoutTxs,
} from "@/lib/api/blockscout";
import { fetchBlockscoutV2Activity } from "@/lib/api/blockscout-v2";
import { fetchBasescanTxs } from "@/lib/api/basescan";
import { fetchUserOperationActivity } from "@/lib/api/user-operations";
import { mergeTransfers } from "@/lib/utils/wallet-activity";
import type { AlchemyTransfer } from "@/lib/types/wallet";

export interface WalletTxSources {
  alchemyOut: number;
  alchemyIn: number;
  blockscoutV1: number;
  blockscoutInternalV1: number;
  blockscoutV2: number;
  userOperations: number;
  basescan: number;
  merged: number;
}

const ALCHEMY_PAGES = 20;

/** All sources merged — matches pre-change pipeline + v2 smart wallet + paymaster user ops. */
export async function fetchWalletTransfersMerged(
  address: string,
  basescanKey = ""
): Promise<{ transfers: AlchemyTransfer[]; sources: WalletTxSources }> {
  const [
    alchemyOut,
    alchemyIn,
    blockscoutTxs,
    internalTxs,
    blockscoutV2,
    userOps,
    basescanTxs,
  ] = await Promise.all([
    fetchAlchemyTxsFast(address, ALCHEMY_PAGES).catch(() => []),
    fetchAlchemyTxsIncoming(address, ALCHEMY_PAGES).catch(() => []),
    fetchBlockscoutTxs(address, 10).catch(() => []),
    fetchBlockscoutInternalTxs(address, 10).catch(() => []),
    fetchBlockscoutV2Activity(address).catch(() => []),
    fetchUserOperationActivity(address, { timeoutMs: 12_000 }).catch(() => []),
    fetchBasescanTxs(address, basescanKey).catch(() => []),
  ]);

  const transfers = mergeTransfers([
    alchemyOut,
    alchemyIn,
    blockscoutTxs,
    internalTxs,
    basescanTxs,
    blockscoutV2,
    userOps,
  ]);

  return {
    transfers,
    sources: {
      alchemyOut: alchemyOut.length,
      alchemyIn: alchemyIn.length,
      blockscoutV1: blockscoutTxs.length,
      blockscoutInternalV1: internalTxs.length,
      blockscoutV2: blockscoutV2.length,
      userOperations: userOps.length,
      basescan: basescanTxs.length,
      merged: transfers.length,
    },
  };
}
