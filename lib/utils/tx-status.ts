export type LifecycleStatus =
  | {
      statusName: "success";
      statusData: {
        transactionReceipts: Array<{ transactionHash: string }>;
      };
    }
  | {
      statusName: "transactionLegacyExecuted";
      statusData: {
        transactionHashList: string[];
      };
    }
  | {
      statusName: string;
      statusData?: Record<string, unknown> | unknown;
    };

/** Extract the primary tx hash from an OnchainKit lifecycle update (incl. MetaMask legacy). */
export function txHashFromLifecycle(status: LifecycleStatus): string {
  if (status.statusName === "success") {
    const receipts = (status.statusData as { transactionReceipts?: Array<{ transactionHash: string }> })?.transactionReceipts;
    return receipts?.[receipts.length - 1]?.transactionHash ?? "";
  }
  if (status.statusName === "transactionLegacyExecuted") {
    const list = (status.statusData as { transactionHashList?: string[] })?.transactionHashList;
    return list?.[list.length - 1] ?? "";
  }
  return "";
}

export function isLifecycleSuccess(status: LifecycleStatus): boolean {
  return (
    status.statusName === "success" ||
    status.statusName === "transactionLegacyExecuted"
  );
}
