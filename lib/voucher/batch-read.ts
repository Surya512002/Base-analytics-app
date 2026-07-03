import { type Address } from "viem";
import { VOUCHER_ABI } from "@/lib/constants/contracts";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import type { VoucherBatchMeta } from "@/lib/types/voucher";
import {
  formatCardId,
  formatVoucherAmount,
  tokenToAsset,
  type VoucherAsset,
} from "@/lib/utils/voucher";
import { readStoredBatches } from "@/lib/voucher/batch-store";

export interface BatchLiveStatus {
  batchId: number;
  creator: string;
  asset: VoucherAsset;
  totalAmount: string;
  amountPerCard: string;
  cardCount: number;
  redeemedCount: number;
  unredeemedCount: number;
  message: string;
  amountPerCardFormatted: string;
  totalAmountFormatted: string;
  createdAt?: number;
  txHash?: string;
  onchain: boolean;
}

export interface BatchCardLiveStatus {
  cardIndex: number;
  cardId: string;
  redeemed: boolean;
}

export interface CreatorBatchSummary {
  creator: string;
  batchCount: number;
  totalCards: number;
  totalRedeemed: number;
  totalUnredeemed: number;
  batches: BatchLiveStatus[];
}

function getClient() {
  if (!VOUCHER_CONTRACT) return null;
  return createBasePublicClient();
}

export async function readOnchainBatch(
  batchId: number
): Promise<BatchLiveStatus | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const [creator, token, amountPerCard, cardCount, redeemedCount, message] =
      await client.readContract({
        address: VOUCHER_CONTRACT as Address,
        abi: VOUCHER_ABI,
        functionName: "getBatch",
        args: [BigInt(batchId)],
      });

    const count = Number(cardCount);
    if (count === 0) return null;

    const asset = tokenToAsset(token as string);
    const perCard = amountPerCard as bigint;
    const total = perCard * BigInt(count);
    const redeemed = Number(redeemedCount);

    return {
      batchId,
      creator: (creator as string).toLowerCase(),
      asset,
      totalAmount: total.toString(),
      amountPerCard: perCard.toString(),
      cardCount: count,
      redeemedCount: redeemed,
      unredeemedCount: Math.max(0, count - redeemed),
      message: message as string,
      amountPerCardFormatted: formatVoucherAmount(asset, perCard),
      totalAmountFormatted: formatVoucherAmount(asset, total),
      onchain: true,
    };
  } catch {
    return null;
  }
}

export async function readBatchCardStatuses(
  batchId: number,
  cardCount: number
): Promise<BatchCardLiveStatus[]> {
  const client = getClient();
  if (!client || cardCount < 1) return [];

  const contracts = Array.from({ length: cardCount }, (_, i) => ({
    address: VOUCHER_CONTRACT as Address,
    abi: VOUCHER_ABI,
    functionName: "isCardRedeemed" as const,
    args: [BigInt(batchId), BigInt(i)] as const,
  }));

  try {
    const results = await client.multicall({ contracts, allowFailure: true });
    return results.map((r, i) => ({
      cardIndex: i,
      cardId: formatCardId(batchId, i),
      redeemed: r.status === "success" ? Boolean(r.result) : false,
    }));
  } catch {
    return [];
  }
}

async function discoverCreatorBatchIds(creator: string): Promise<number[]> {
  const client = getClient();
  if (!client || !VOUCHER_CONTRACT) return [];

  const normalized = creator.toLowerCase();
  const ids = new Set<number>();

  try {
    const nextId = await client.readContract({
      address: VOUCHER_CONTRACT as Address,
      abi: VOUCHER_ABI,
      functionName: "nextBatchId",
    });
    const max = Number(nextId);
    for (let batchId = 1; batchId < max; batchId++) {
      const live = await readOnchainBatch(batchId);
      if (live?.creator === normalized) ids.add(batchId);
    }
  } catch {
    /* RPC unavailable */
  }

  return [...ids].sort((a, b) => b - a);
}

async function discoverBatchIdsFromStoredTxs(creator: string): Promise<number[]> {
  const client = getClient();
  if (!client) return [];

  const normalized = creator.toLowerCase();
  const ids = new Set<number>();

  try {
    const stored = await readStoredBatches();
    const { recoverBatchFromTx } = await import("@/lib/voucher/tx-recovery");

    for (const meta of stored) {
      if (!meta.txHash) continue;
      const recovered = await recoverBatchFromTx(
        client,
        meta.txHash as `0x${string}`,
        normalized
      );
      if (recovered) ids.add(recovered.batchId);
    }
  } catch {
    /* ignore */
  }

  return [...ids];
}

function mergeMeta(
  live: BatchLiveStatus,
  meta?: VoucherBatchMeta
): BatchLiveStatus {
  if (!meta) return live;
  return {
    ...live,
    createdAt: meta.createdAt,
    txHash: meta.txHash,
    message: live.message || meta.message,
  };
}

export async function listCreatorBatches(
  creator: string,
  options?: { includeStored?: boolean; scanChain?: boolean }
): Promise<CreatorBatchSummary> {
  const normalized = creator.toLowerCase();
  const includeStored = options?.includeStored !== false;
  const scanChain = options?.scanChain !== false;

  const batchIds = new Set<number>();
  const metaById = new Map<number, VoucherBatchMeta>();

  if (includeStored) {
    try {
      const stored = await readStoredBatches();
      const client = getClient();
      for (const b of stored) {
        if (b.creator.toLowerCase() === normalized) {
          batchIds.add(b.batchId);
          metaById.set(b.batchId, b);
        } else if (b.txHash && client) {
          const { recoverBatchFromTx } = await import("@/lib/voucher/tx-recovery");
          const recovered = await recoverBatchFromTx(
            client,
            b.txHash as `0x${string}`,
            normalized
          );
          if (recovered) {
            batchIds.add(recovered.batchId);
            metaById.set(recovered.batchId, {
              ...b,
              batchId: recovered.batchId,
              creator: normalized,
            });
          }
        }
      }
    } catch {
      /* Redis optional for read path */
    }
  }

  if (scanChain) {
    const chainIds = await discoverCreatorBatchIds(normalized);
    for (const id of chainIds) batchIds.add(id);
    const txIds = await discoverBatchIdsFromStoredTxs(normalized);
    for (const id of txIds) batchIds.add(id);
  }

  const batches: BatchLiveStatus[] = [];
  for (const batchId of [...batchIds].sort((a, b) => b - a)) {
    const live = await readOnchainBatch(batchId);
    const meta = metaById.get(batchId);
    if (live && (live.creator === normalized || meta)) {
      batches.push(
        mergeMeta(
          meta ? { ...live, creator: normalized } : live,
          meta
        )
      );
    } else if (meta) {
      batches.push({
        batchId: meta.batchId,
        creator: meta.creator,
        asset: meta.asset,
        totalAmount: meta.totalAmount,
        amountPerCard: meta.amountPerCard,
        cardCount: meta.cardCount,
        redeemedCount: meta.redeemedCount,
        unredeemedCount: Math.max(0, meta.cardCount - meta.redeemedCount),
        message: meta.message,
        amountPerCardFormatted: formatVoucherAmount(
          meta.asset,
          BigInt(meta.amountPerCard)
        ),
        totalAmountFormatted: formatVoucherAmount(
          meta.asset,
          BigInt(meta.totalAmount)
        ),
        createdAt: meta.createdAt,
        txHash: meta.txHash,
        onchain: false,
      });
    }
  }

  const totalCards = batches.reduce((s, b) => s + b.cardCount, 0);
  const totalRedeemed = batches.reduce((s, b) => s + b.redeemedCount, 0);

  return {
    creator: normalized,
    batchCount: batches.length,
    totalCards,
    totalRedeemed,
    totalUnredeemed: totalCards - totalRedeemed,
    batches,
  };
}

export async function readBatchDetail(batchId: number): Promise<{
  batch: BatchLiveStatus | null;
  cards: BatchCardLiveStatus[];
}> {
  const batch = await readOnchainBatch(batchId);
  if (!batch) return { batch: null, cards: [] };

  let meta: VoucherBatchMeta | undefined;
  try {
    const stored = await readStoredBatches();
    meta = stored.find((b) => b.batchId === batchId);
  } catch {
    /* ignore */
  }

  const cards = await readBatchCardStatuses(batchId, batch.cardCount);
  return { batch: mergeMeta(batch, meta), cards };
}

/** Link a deposit tx to a wallet for My Cards recovery. */
export async function recoverBatchForWallet(
  txHash: string,
  wallet: string
): Promise<BatchLiveStatus | null> {
  const client = getClient();
  if (!client) return null;

  const { recoverBatchFromTx } = await import("@/lib/voucher/tx-recovery");
  const recovered = await recoverBatchFromTx(
    client,
    txHash as `0x${string}`,
    wallet
  );
  if (!recovered) return null;

  const live = await readOnchainBatch(recovered.batchId);
  if (!live) return null;

  return {
    ...live,
    creator: wallet.toLowerCase(),
    txHash,
  };
}
