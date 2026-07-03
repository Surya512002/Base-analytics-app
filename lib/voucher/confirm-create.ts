import { VOUCHER_ABI } from "@/lib/constants/contracts";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";
import {
  formatCardId,
  hashVoucherSecret,
  type StoredVoucherBatch,
} from "@/lib/utils/voucher";
import {
  batchCreatedInTx,
  walletParticipatedInBatchTx,
  type VoucherChainReader,
} from "@/lib/voucher/tx-recovery";

const RECEIPT_TIMEOUT_MS = 120_000;
const POLL_ATTEMPTS = 10;
const POLL_BASE_MS = 1_500;

type ConfirmClient = VoucherChainReader & {
  waitForTransactionReceipt: (args: {
    hash: `0x${string}`;
    timeout?: number;
  }) => Promise<{ status: string }>;
  readContract: (args: {
    address: `0x${string}`;
    abi: typeof VOUCHER_ABI;
    functionName: string;
    args: readonly unknown[];
  }) => Promise<unknown>;
};

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

/** Match pending card secrets against on-chain hashes (works even if creator address differs). */
export async function secretsMatchOnChain(
  publicClient: ConfirmClient,
  batch: StoredVoucherBatch
): Promise<boolean> {
  if (!batch.cards.some((c) => c.secret)) return false;

  try {
    const checks = await Promise.all(
      batch.cards.map(async (card, i) => {
        if (!card.secret) return false;
        const onChainHash = (await publicClient.readContract({
          address: VOUCHER_CONTRACT as `0x${string}`,
          abi: VOUCHER_ABI,
          functionName: "cardSecretHashes",
          args: [BigInt(batch.batchId), BigInt(i)],
        })) as `0x${string}`;
        return hashVoucherSecret(card.secret) === onChainHash;
      })
    );
    return checks.every(Boolean);
  } catch {
    return false;
  }
}

async function tryResolveBatchBySecrets(
  publicClient: ConfirmClient,
  pending: StoredVoucherBatch,
  hintBatchId: number,
  onChainCreator?: string
): Promise<StoredVoucherBatch | null> {
  const ids = new Set<number>();
  ids.add(hintBatchId);
  for (let delta = 1; delta <= 3; delta++) {
    if (hintBatchId - delta >= 1) ids.add(hintBatchId - delta);
    ids.add(hintBatchId + delta);
  }

  for (const batchId of ids) {
    const candidate = reconcileBatchId(pending, batchId, onChainCreator);
    if (await secretsMatchOnChain(publicClient, candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * After deposit: attach pending secrets to the batch created in txHash.
 * Primary path for showing Card ID + Secret in Base App.
 */
export async function finalizePendingBatchFromTx(
  publicClient: ConfirmClient,
  pending: StoredVoucherBatch,
  txHash: string
): Promise<StoredVoucherBatch | null> {
  if (!VOUCHER_CONTRACT || !pending.cards.some((c) => c.secret)) return null;

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        timeout: RECEIPT_TIMEOUT_MS,
      });
      if (receipt.status !== "success") return null;

      const fromReceipt = await batchCreatedInTx(
        publicClient,
        txHash as `0x${string}`
      );
      if (fromReceipt) {
        const matched = await tryResolveBatchBySecrets(
          publicClient,
          pending,
          fromReceipt.batchId,
          fromReceipt.onChainCreator
        );
        if (matched) return { ...matched, txHash };
      }
    } catch {
      /* receipt not ready yet */
    }
    await new Promise((r) => setTimeout(r, POLL_BASE_MS * (attempt + 1)));
  }

  return null;
}

/** Match pending card secrets against on-chain hashes (internal alias). */
async function secretsMatchOnChainInternal(
  publicClient: ConfirmClient,
  batch: StoredVoucherBatch
): Promise<boolean> {
  return secretsMatchOnChain(publicClient, batch);
}

async function verifyBatchOnChain(
  publicClient: ConfirmClient,
  batch: StoredVoucherBatch,
  creator: string,
  txHash?: string
): Promise<boolean> {
  try {
    const onChain = (await publicClient.readContract({
      address: VOUCHER_CONTRACT as `0x${string}`,
      abi: VOUCHER_ABI,
      functionName: "getBatch",
      args: [BigInt(batch.batchId)],
    })) as readonly [string, string, bigint, bigint, bigint, string];
    const [batchCreator, , , cardCount] = onChain;
    if (Number(cardCount) < batch.cardCount) return false;

    if (await secretsMatchOnChainInternal(publicClient, batch)) return true;

    if (batchCreator.toLowerCase() === creator.toLowerCase()) return true;

    if (
      txHash &&
      (await walletParticipatedInBatchTx(
        publicClient,
        txHash as `0x${string}`,
        creator
      ))
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/** Wait for funding tx, resolve the real batchId, and verify the batch exists onchain. */
export async function confirmVoucherBatchCreate(
  publicClient: ConfirmClient,
  batch: StoredVoucherBatch,
  creator: string,
  txHash?: string
): Promise<StoredVoucherBatch | null> {
  if (!VOUCHER_CONTRACT) return null;

  let resolved = batch;

  if (txHash) {
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        timeout: RECEIPT_TIMEOUT_MS,
      });
      if (receipt.status !== "success") return null;

      const fromReceipt = await batchCreatedInTx(
        publicClient,
        txHash as `0x${string}`
      );
      if (fromReceipt) {
        resolved = reconcileBatchId(
          batch,
          fromReceipt.batchId,
          fromReceipt.onChainCreator
        );
        if (await verifyBatchOnChain(publicClient, resolved, creator, txHash)) {
          return { ...resolved, txHash };
        }
      }
    } catch {
      /* fall through to polling */
    }
  }

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    if (await verifyBatchOnChain(publicClient, resolved, creator, txHash)) {
      return { ...resolved, txHash };
    }
    await new Promise((r) => setTimeout(r, POLL_BASE_MS * (attempt + 1)));
  }

  return null;
}

/** Cast wagmi/viem clients for voucher confirmation helpers. */
export function asConfirmClient(client: unknown): ConfirmClient {
  return client as ConfirmClient;
}
