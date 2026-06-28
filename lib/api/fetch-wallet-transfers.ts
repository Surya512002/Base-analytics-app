import {
  fetchAlchemyTxsFast,
  fetchAlchemyTxsIncoming,
} from "@/lib/api/alchemy";
import { fetchBlockscoutV2Activity } from "@/lib/api/blockscout-v2";
import { fetchBasescanTxs } from "@/lib/api/basescan";
import { mergeTransfers } from "@/lib/utils/wallet-activity";
import type { AlchemyTransfer } from "@/lib/types/wallet";

export interface WalletTxSources {
  alchemyOut: number;
  alchemyIn: number;
  basescan: number;
  blockscoutV2: number;
  merged: number;
}

/** Server-side merge of all wallet activity sources (optimized for Base App / smart wallets). */
export async function fetchWalletTransfersMerged(
  address: string,
  basescanKey = ""
): Promise<{ transfers: AlchemyTransfer[]; sources: WalletTxSources }> {
  const [alchemyOut, alchemyIn, basescanTxs, blockscoutV2] = await Promise.all([
    fetchAlchemyTxsFast(address).catch(() => []),
    fetchAlchemyTxsIncoming(address).catch(() => []),
    fetchBasescanTxs(address, basescanKey).catch(() => []),
    fetchBlockscoutV2Activity(address).catch(() => []),
  ]);

  const transfers = mergeTransfers([
    alchemyOut,
    alchemyIn,
    basescanTxs,
    blockscoutV2,
  ]);

  return {
    transfers,
    sources: {
      alchemyOut: alchemyOut.length,
      alchemyIn: alchemyIn.length,
      basescan: basescanTxs.length,
      blockscoutV2: blockscoutV2.length,
      merged: transfers.length,
    },
  };
}
