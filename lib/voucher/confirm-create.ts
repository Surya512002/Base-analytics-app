import {
  parseEventLogs,
  type PublicClient,
} from "viem";
import { VOUCHER_ABI } from "@/lib/constants/contracts";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";
import {
  formatCardId,
  hashVoucherSecret,
  type StoredVoucherBatch,
} from "@/lib/utils/voucher";

const RECEIPT_TIMEOUT_MS = 120_000;
const POLL_ATTEMPTS = 10;
const POLL_BASE_MS = 1_500;

function reconcileBatchId(
  batch: StoredVoucherBatch,
  actualBatchId: number,
  onChainCreator?: string
): StoredVoucherBatch {
  const next = {
    ...batch,
    batchId: actualBatchId,
    creator: onChainCreator ?? batch.creator,
    cards: batch.cards.map((c, i) => ({
      ...c,
      batchId: actualBatchId,
      cardIndex: i,
      cardId: formatCardId(actualBatchId, i),
    })),
  };
  if (batch.batchId === actualBatchId && !onChainCreator) return batch;
  return next;
}

async function batchFromReceipt(
  publicClient: PublicClient,
  txHash: `0x${string}`
): Promise<{ batchId: number; creator: string } | null> {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: RECEIPT_TIMEOUT_MS,
  });
  if (receipt.status !== "success") return null;

  const voucherLogs = receipt.logs.filter(
    (log) =>
      log.address.toLowerCase() === VOUCHER_CONTRACT.toLowerCase()
  );
  if (voucherLogs.length === 0) return null;

  const events = parseEventLogs({
    abi: VOUCHER_ABI,
    logs: voucherLogs,
    eventName: "BatchCreated",
  });
  const created = events[0];
  if (!created?.args.batchId || !created.args.creator) return null;

  return {
    batchId: Number(created.args.batchId),
    creator: created.args.creator,
  };
}

/** Match pending card secrets against on-chain hashes (works even if creator address differs). */
async function secretsMatchOnChain(
  publicClient: PublicClient,
  batch: StoredVoucherBatch
): Promise<boolean> {
  if (!batch.cards.some((c) => c.secret)) return false;

  try {
    const checks = await Promise.all(
      batch.cards.slice(0, 3).map(async (card, i) => {
        if (!card.secret) return false;
        const onChainHash = await publicClient.readContract({
          address: VOUCHER_CONTRACT as `0x${string}`,
          abi: VOUCHER_ABI,
          functionName: "cardSecretHashes",
          args: [BigInt(batch.batchId), BigInt(i)],
        });
        return hashVoucherSecret(card.secret) === onChainHash;
      })
    );
    return checks.some(Boolean);
  } catch {
    return false;
  }
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
    if (Number(cardCount) < batch.cardCount) return false;

    if (await secretsMatchOnChain(publicClient, batch)) return true;

    return batchCreator.toLowerCase() === creator.toLowerCase();
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
      const fromReceipt = await batchFromReceipt(
        publicClient,
        txHash as `0x${string}`
      );
      if (fromReceipt) {
        resolved = reconcileBatchId(
          batch,
          fromReceipt.batchId,
          fromReceipt.creator
        );
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
