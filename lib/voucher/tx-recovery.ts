import { parseEventLogs, type Hash } from "viem";
import { VOUCHER_ABI } from "@/lib/constants/contracts";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";

const ENTRYPOINT_USER_OP_TOPIC =
  "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f";

type TxLog = {
  address: string;
  topics: (string | null)[];
};

type TxReceipt = {
  status: string;
  logs: readonly TxLog[];
};

/** Minimal chain reader — avoids viem PublicClient version mismatches across packages. */
export type VoucherChainReader = {
  getTransactionReceipt: (args: { hash: Hash }) => Promise<TxReceipt>;
  getTransaction: (args: { hash: Hash }) => Promise<{ from: string }>;
};

export interface BatchFromTx {
  batchId: number;
  onChainCreator: string;
}

/** Wallets that signed a user operation inside this transaction (Base App / AA bundles). */
export async function userOpSendersInTx(
  publicClient: VoucherChainReader,
  txHash: Hash
): Promise<string[]> {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    const senders = new Set<string>();
    for (const log of receipt.logs) {
      if (log.topics[0]?.toLowerCase() !== ENTRYPOINT_USER_OP_TOPIC) continue;
      const senderTopic = log.topics[2];
      if (!senderTopic || senderTopic.length < 42) continue;
      senders.add(`0x${senderTopic.slice(-40)}`.toLowerCase());
    }
    return [...senders];
  } catch {
    return [];
  }
}

export async function batchCreatedInTx(
  publicClient: VoucherChainReader,
  txHash: Hash,
  expectedCreator?: string
): Promise<BatchFromTx | null> {
  if (!VOUCHER_CONTRACT) return null;
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") return null;

    const voucherLogs = receipt.logs.filter(
      (log) => log.address.toLowerCase() === VOUCHER_CONTRACT.toLowerCase()
    );
    if (voucherLogs.length === 0) return null;

    const events = parseEventLogs({
      abi: VOUCHER_ABI,
      logs: voucherLogs as Parameters<typeof parseEventLogs>[0]["logs"],
      eventName: "BatchCreated",
    });

    // Bundled txs (Base App / AA) can carry several creations — prefer our own.
    const wanted = expectedCreator?.toLowerCase();
    const created =
      (wanted &&
        events.find(
          (e) => (e.args.creator as string | undefined)?.toLowerCase() === wanted
        )) ||
      events[0];
    if (!created?.args.batchId || !created.args.creator) return null;

    return {
      batchId: Number(created.args.batchId),
      onChainCreator: (created.args.creator as string).toLowerCase(),
    };
  } catch {
    return null;
  }
}

/** True when the wallet signed a user op in the funding tx (Base App bundles). */
export async function walletParticipatedInBatchTx(
  publicClient: VoucherChainReader,
  txHash: Hash,
  wallet: string
): Promise<boolean> {
  const normalized = wallet.toLowerCase();
  const senders = await userOpSendersInTx(publicClient, txHash);
  if (senders.some((s) => s === normalized)) return true;

  try {
    const tx = await publicClient.getTransaction({ hash: txHash });
    return tx.from.toLowerCase() === normalized;
  } catch {
    return false;
  }
}

export async function recoverBatchFromTx(
  publicClient: VoucherChainReader,
  txHash: Hash,
  wallet: string
): Promise<BatchFromTx | null> {
  const batch = await batchCreatedInTx(publicClient, txHash);
  if (!batch) return null;

  const participated = await walletParticipatedInBatchTx(
    publicClient,
    txHash,
    wallet
  );
  const onChainCreatorMatch =
    batch.onChainCreator === wallet.toLowerCase();

  if (!participated && !onChainCreatorMatch) return null;
  return batch;
}
