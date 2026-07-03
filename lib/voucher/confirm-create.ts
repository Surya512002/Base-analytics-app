import {
  parseEventLogs,
  type PublicClient,
} from "viem";
import { VOUCHER_ABI } from "@/lib/constants/contracts";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";
import {
  formatCardId,
  type StoredVoucherBatch,
} from "@/lib/utils/voucher";

const RECEIPT_TIMEOUT_MS = 120_000;
const POLL_ATTEMPTS = 10;
const POLL_BASE_MS = 1_500;

function reconcileBatchId(
  batch: StoredVoucherBatch,
  actualBatchId: number
): StoredVoucherBatch {
  if (batch.batchId === actualBatchId) return batch;
  return {
    ...batch,
    batchId: actualBatchId,
    cards: batch.cards.map((c, i) => ({
      ...c,
      batchId: actualBatchId,
      cardIndex: i,
      cardId: formatCardId(actualBatchId, i),
    })),
  };
}

async function batchIdFromReceipt(
  publicClient: PublicClient,
  txHash: `0x${string}`,
  creator: string
): Promise<number | null> {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: RECEIPT_TIMEOUT_MS,
  });
  if (receipt.status !== "success") return null;

  const events = parseEventLogs({
    abi: VOUCHER_ABI,
    logs: receipt.logs,
    eventName: "BatchCreated",
  });

  const match = events.find(
    (e) =>
      e.args.creator?.toLowerCase() === creator.toLowerCase() &&
      e.args.batchId !== undefined
  );
  return match ? Number(match.args.batchId) : null;
}

async function verifyBatchOnChain(
  publicClient: PublicClient,
  batch: StoredVoucherBatch,
  creator: string
): Promise<boolean> {
  try {
    const onChain = await publicClient.readContract({
      address: VOUCHER_CONTRACT as `0x${string}`,
      abi: VOUCHER_ABI,
      functionName: "getBatch",
      args: [BigInt(batch.batchId)],
    });
    const [batchCreator, , , cardCount] = onChain;
    return (
      batchCreator.toLowerCase() === creator.toLowerCase() &&
      Number(cardCount) >= batch.cardCount
    );
  } catch {
    return false;
  }
}

/** Wait for funding tx, resolve the real batchId, and verify the batch exists onchain. */
export async function confirmVoucherBatchCreate(
  publicClient: PublicClient,
  batch: StoredVoucherBatch,
  creator: string,
  txHash?: string
): Promise<StoredVoucherBatch | null> {
  if (!VOUCHER_CONTRACT) return null;

  let resolved = batch;

  if (txHash) {
    try {
      const batchId = await batchIdFromReceipt(
        publicClient,
        txHash as `0x${string}`,
        creator
      );
      if (batchId !== null) {
        resolved = reconcileBatchId(batch, batchId);
        if (await verifyBatchOnChain(publicClient, resolved, creator)) {
          return resolved;
        }
      }
    } catch {
      /* fall through to polling */
    }
  }

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    if (await verifyBatchOnChain(publicClient, resolved, creator)) {
      return resolved;
    }
    await new Promise((r) => setTimeout(r, POLL_BASE_MS * (attempt + 1)));
  }

  return null;
}
