import {
  fetchAlchemyTxsFast,
  fetchAlchemyTxsIncoming,
} from "@/lib/api/alchemy";
import {
  fetchBlockscoutInternalTxs,
  fetchBlockscoutTokenTxs,
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
  blockscoutTokenV1: number;
  blockscoutV2: number;
  userOperations: number;
  basescan: number;
  merged: number;
}

/** All sources merged — paginates until exhausted (within safety caps). */
export async function fetchWalletTransfersMerged(
  address: string,
  basescanKey = ""
): Promise<{ transfers: AlchemyTransfer[]; sources: WalletTxSources }> {
  const [
    alchemyOut,
    alchemyIn,
    blockscoutTxs,
    internalTxs,
    tokenTxs,
    blockscoutV2,
    userOps,
    basescanTxs,
  ] = await Promise.all([
    fetchAlchemyTxsFast(address).catch(() => []),
    fetchAlchemyTxsIncoming(address).catch(() => []),
    fetchBlockscoutTxs(address).catch(() => []),
    fetchBlockscoutInternalTxs(address).catch(() => []),
    fetchBlockscoutTokenTxs(address).catch(() => []),
    fetchBlockscoutV2Activity(address).catch(() => []),
    fetchUserOperationActivity(address).catch(() => []),
    fetchBasescanTxs(address, basescanKey).catch(() => []),
  ]);

  const transfers = mergeTransfers([
    alchemyOut,
    alchemyIn,
    blockscoutTxs,
    internalTxs,
    tokenTxs,
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
      blockscoutTokenV1: tokenTxs.length,
      blockscoutV2: blockscoutV2.length,
      userOperations: userOps.length,
      basescan: basescanTxs.length,
      merged: transfers.length,
    },
  };
}
