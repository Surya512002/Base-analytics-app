import {
  fetchBlockscoutInternalTxs,
  fetchBlockscoutNftTxs,
  fetchBlockscoutTokenTxs,
} from "@/lib/api/blockscout";
import { fetchUserOperationActivityFull } from "@/lib/api/user-operations";
import { enrichTransferLegs, mergeTransfers } from "@/lib/utils/wallet-activity";
import type { AlchemyTransfer } from "@/lib/types/wallet";

/** Extra Blockscout v1 token/internal/NFT + user-op scan after v2 pagination. */
export async function collectWalletSupplements(
  address: string,
  opts: { deadlineMs?: number } = {}
): Promise<{
  transfers: AlchemyTransfer[];
  userOpsFetched: boolean;
  v1SupplementFetched: boolean;
}> {
  const addr = address.toLowerCase();
  const deadlineMs = opts.deadlineMs ?? 15_000;
  const [tokenTxs, internalTxs, nftTxs, userOps] = await Promise.all([
    fetchBlockscoutTokenTxs(addr, { deadlineMs }).catch(() => []),
    fetchBlockscoutInternalTxs(addr, { deadlineMs }).catch(() => []),
    fetchBlockscoutNftTxs(addr, { deadlineMs }).catch(() => []),
    fetchUserOperationActivityFull(addr).catch(() => []),
  ]);

  return {
    transfers: enrichTransferLegs(
      mergeTransfers([tokenTxs, internalTxs, nftTxs, userOps]),
      addr
    ),
    userOpsFetched: true,
    v1SupplementFetched: true,
  };
}
