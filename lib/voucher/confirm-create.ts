import { VOUCHER_ABI } from "@/lib/constants/contracts";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";
import {
  formatCardId,
  hashVoucherSecret,
  type StoredVoucherBatch,
} from "@/lib/utils/voucher";
import {
  batchCreatedInTx,
  type VoucherChainReader,
} from "@/lib/voucher/tx-recovery";

const RECEIPT_TIMEOUT_MS = 120_000;
const POLL_ATTEMPTS = 20;
const POLL_BASE_MS = 2_000;
const BATCH_SCAN_LOOKBACK = 25;

export type ConfirmClient = VoucherChainReader & {
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
  return {
    ...batch,
    batchId: actualBatchId,
    creator: onChainCreator ?? batch.creator,
    cards: batch.cards.map((c, i) => ({
      ...c,
      batchId: actualBatchId,
      cardIndex: i,
      cardId: formatCardId(actualBatchId, i),
      secret: batch.cards[i]?.secret ?? c.secret,
    })),
  };
}

/** Never drop locally generated secrets when reconciling on-chain metadata. */
export function preservePendingSecrets(
  pending: StoredVoucherBatch,
  resolved: StoredVoucherBatch
): StoredVoucherBatch {
  return {
    ...resolved,
    cards: resolved.cards.map((c, i) => ({
      ...c,
      secret: pending.cards[i]?.secret ?? c.secret,
    })),
  };
}

/** Match every pending card secret against on-chain hashes for a batch id. */
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

async function readNextBatchId(publicClient: ConfirmClient): Promise<number> {
  const next = (await publicClient.readContract({
    address: VOUCHER_CONTRACT as `0x${string}`,
    abi: VOUCHER_ABI,
    functionName: "nextBatchId",
    args: [],
  })) as bigint;
  return Number(next);
}

/** Scan recent on-chain batches until pending secrets match (handles batchId race). */
export async function findBatchIdBySecrets(
  publicClient: ConfirmClient,
  pending: StoredVoucherBatch,
  hintBatchId?: number
): Promise<StoredVoucherBatch | null> {
  if (!pending.cards.some((c) => c.secret)) return null;

  const ids = new Set<number>();
  if (hintBatchId != null) {
    ids.add(hintBatchId);
    for (let delta = 1; delta <= 5; delta++) {
      if (hintBatchId - delta >= 1) ids.add(hintBatchId - delta);
      ids.add(hintBatchId + delta);
    }
  }

  try {
    const nextId = await readNextBatchId(publicClient);
    for (let id = nextId - 1; id >= Math.max(1, nextId - BATCH_SCAN_LOOKBACK); id--) {
      ids.add(id);
    }
  } catch {
    /* fall through with hint ids only */
  }

  for (const batchId of [...ids].sort((a, b) => b - a)) {
    const candidate = reconcileBatchId(pending, batchId);
    if (await secretsMatchOnChain(publicClient, candidate)) {
      return candidate;
    }
  }
  return null;
}

async function verifyBatchOnChain(
  publicClient: ConfirmClient,
  batch: StoredVoucherBatch,
  _creator: string,
  _txHash?: string
): Promise<boolean> {
  try {
    const onChain = (await publicClient.readContract({
      address: VOUCHER_CONTRACT as `0x${string}`,
      abi: VOUCHER_ABI,
      functionName: "getBatch",
      args: [BigInt(batch.batchId)],
    })) as readonly [string, string, bigint, bigint, bigint, string];
    const [, , , cardCount] = onChain;
    if (Number(cardCount) < batch.cardCount) return false;

    return secretsMatchOnChain(publicClient, batch);
  } catch {
    return false;
  }
}

/**
 * After deposit: attach pending secrets to the batch created in txHash.
 * Primary path for showing Card ID + Secret (Base App + all wallets).
 */
export async function finalizePendingBatchFromTx(
  publicClient: ConfirmClient,
  pending: StoredVoucherBatch,
  txHash: string
): Promise<StoredVoucherBatch | null> {
  if (!VOUCHER_CONTRACT || !pending.cards.some((c) => c.secret)) return null;

  let receiptReady = false;
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    if (!receiptReady) {
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash as `0x${string}`,
          timeout: RECEIPT_TIMEOUT_MS,
        });
        if (receipt.status !== "success") return null;
        receiptReady = true;
      } catch {
        await new Promise((r) => setTimeout(r, POLL_BASE_MS * (attempt + 1)));
        continue;
      }
    }

    const fromReceipt = await batchCreatedInTx(
      publicClient,
      txHash as `0x${string}`
    );

    const matched = await findBatchIdBySecrets(
      publicClient,
      pending,
      fromReceipt?.batchId
    );
    if (matched) {
      return preservePendingSecrets(pending, { ...matched, txHash });
    }

    await new Promise((r) => setTimeout(r, POLL_BASE_MS * (attempt + 1)));
  }

  return null;
}

/** Wait for funding tx, resolve batchId, preserve secrets — works across wallet types. */
export async function confirmVoucherBatchCreate(
  publicClient: ConfirmClient,
  batch: StoredVoucherBatch,
  creator: string,
  txHash?: string
): Promise<StoredVoucherBatch | null> {
  if (!VOUCHER_CONTRACT) return null;

  if (txHash && batch.cards.some((c) => c.secret)) {
    const fromSecrets = await finalizePendingBatchFromTx(
      publicClient,
      batch,
      txHash
    );
    if (fromSecrets) return fromSecrets;
  }

  let resolved = batch;

  if (txHash) {
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        timeout: RECEIPT_TIMEOUT_MS,
      });
      if (receipt.status === "success") {
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
          const bySecrets = await findBatchIdBySecrets(
            publicClient,
            batch,
            fromReceipt.batchId
          );
          if (bySecrets) {
            return preservePendingSecrets(batch, { ...bySecrets, txHash });
          }
          if (await verifyBatchOnChain(publicClient, resolved, creator, txHash)) {
            return preservePendingSecrets(batch, { ...resolved, txHash });
          }
        }
      }
    } catch {
      /* fall through to polling */
    }
  }

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    const bySecrets = await findBatchIdBySecrets(publicClient, batch, resolved.batchId);
    if (bySecrets) {
      return preservePendingSecrets(batch, { ...bySecrets, txHash });
    }
    if (await verifyBatchOnChain(publicClient, resolved, creator, txHash)) {
      return preservePendingSecrets(batch, { ...resolved, txHash });
    }
    await new Promise((r) => setTimeout(r, POLL_BASE_MS * (attempt + 1)));
  }

  return null;
}

export function asConfirmClient(client: unknown): ConfirmClient {
  return client as ConfirmClient;
}
