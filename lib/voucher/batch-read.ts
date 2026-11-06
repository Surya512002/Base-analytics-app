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

export const VOUCHER_V2_CONTRACT = "0xc118afff969db6cd6d2de639e2c8ba1223768fce" as const;
export const VOUCHER_V1_CONTRACT = "0xE425b060d888DD54C57160f4c3B0d3Fb76EcCf25" as const;
export const ALL_VOUCHER_CONTRACTS: readonly Address[] = [
  (VOUCHER_CONTRACT as Address) || VOUCHER_V2_CONTRACT,
  VOUCHER_V1_CONTRACT,
];

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
  contractAddress?: string;
  unlockTimestamp?: number;
  expirationTimestamp?: number;
  requiredSigner?: string;
  isUnlocked?: boolean;
  isExpired?: boolean;
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
  batchId: number,
  targetContract?: Address
): Promise<BatchLiveStatus | null> {
  const client = getClient();
  if (!client) return null;

  const candidates: Address[] = targetContract
    ? [targetContract]
    : Array.from(new Set(ALL_VOUCHER_CONTRACTS));

  for (const contractAddr of candidates) {
    try {
      const [creator, token, amountPerCard, cardCount, redeemedCount, message] =
        await client.readContract({
          address: contractAddr,
          abi: VOUCHER_ABI,
          functionName: "getBatch",
          args: [BigInt(batchId)],
        });

      const count = Number(cardCount);
      if (count === 0) continue;

      const asset = tokenToAsset(token as string);
      const perCard = amountPerCard as bigint;
      const total = perCard * BigInt(count);
      const redeemed = Number(redeemedCount);

      let unlockTimestamp = 0;
      let expirationTimestamp = 0;
      let requiredSigner: string | undefined = undefined;
      try {
        const config = await client.readContract({
          address: contractAddr,
          abi: VOUCHER_ABI,
          functionName: "getBatchConfig",
          args: [BigInt(batchId)],
        });
        unlockTimestamp = Number(config[0]);
        expirationTimestamp = Number(config[1]);
        if (config[2] && config[2] !== "0x0000000000000000000000000000000000000000") {
          requiredSigner = (config[2] as string).toLowerCase();
        }
      } catch {
        // Legacy deployment graceful fallback
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const isUnlocked = unlockTimestamp === 0 || nowSec >= unlockTimestamp;
      const isExpired = expirationTimestamp > 0 && nowSec >= expirationTimestamp;

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
        contractAddress: contractAddr.toLowerCase(),
        unlockTimestamp: unlockTimestamp || undefined,
        expirationTimestamp: expirationTimestamp || undefined,
        requiredSigner,
        isUnlocked,
        isExpired,
      };
    } catch {
      // try next candidate contract
    }
  }

  return null;
}

export async function readBatchCardStatuses(
  batchId: number,
  cardCount: number,
  targetContract?: Address
): Promise<BatchCardLiveStatus[]> {
  const client = getClient();
  if (!client || cardCount < 1) return [];

  const contractAddress = targetContract || (VOUCHER_CONTRACT as Address);
  const contracts = Array.from({ length: cardCount }, (_, i) => ({
    address: contractAddress,
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
  if (!client) return [];

  const normalized = creator.toLowerCase();
  const ids = new Set<number>();
  const contractsToScan = Array.from(new Set(ALL_VOUCHER_CONTRACTS));

  for (const contractAddr of contractsToScan) {
    try {
      const nextId = await client.readContract({
        address: contractAddr,
        abi: VOUCHER_ABI,
        functionName: "nextBatchId",
      });
      const max = Number(nextId);
      if (max <= 1) continue;

      const batchIdsToQuery: number[] = [];
      for (let batchId = 1; batchId < max; batchId++) {
        batchIdsToQuery.push(batchId);
      }

      // Query in multicall chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < batchIdsToQuery.length; i += chunkSize) {
        const chunk = batchIdsToQuery.slice(i, i + chunkSize);
        const calls = chunk.map((bId) => ({
          address: contractAddr,
          abi: VOUCHER_ABI,
          functionName: "getBatch" as const,
          args: [BigInt(bId)] as const,
        }));
        try {
          const results = await client.multicall({ contracts: calls, allowFailure: true });
          results.forEach((res, idx) => {
            if (res.status === "success" && Array.isArray(res.result)) {
              const [bCreator, , , bCardCount] = res.result;
              if (
                Number(bCardCount) > 0 &&
                typeof bCreator === "string" &&
                bCreator.toLowerCase() === normalized
              ) {
                ids.add(chunk[idx]);
              }
            }
          });
        } catch {
          // Fallback to sequential if multicall chunk fails
          for (const bId of chunk) {
            const live = await readOnchainBatch(bId, contractAddr);
            if (live?.creator === normalized) ids.add(bId);
          }
        }
      }
    } catch {
      /* RPC unavailable or contract not deployed on this network */
    }
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
    // Strict isolation: only return verified onchain batches where creator matches normalized
    if (live && live.creator.toLowerCase() === normalized) {
      batches.push(mergeMeta(live, meta));
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

  const cards = await readBatchCardStatuses(
    batchId,
    batch.cardCount,
    batch.contractAddress as Address | undefined
  );
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
