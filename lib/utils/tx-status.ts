import type { LifecycleStatus } from "@coinbase/onchainkit/transaction";

/** Extract the primary tx hash from an OnchainKit lifecycle update (incl. MetaMask legacy). */
export function txHashFromLifecycle(status: LifecycleStatus): string {
  if (status.statusName === "success") {
    const receipts = status.statusData.transactionReceipts;
    return receipts[receipts.length - 1]?.transactionHash ?? "";
  }
  if (status.statusName === "transactionLegacyExecuted") {
    const list = status.statusData.transactionHashList;
    return list[list.length - 1] ?? "";
  }
  return "";
}

export function isLifecycleSuccess(status: LifecycleStatus): boolean {
  return (
    status.statusName === "success" ||
    status.statusName === "transactionLegacyExecuted"
  );
}
