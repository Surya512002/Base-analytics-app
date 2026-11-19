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
import {
  VOUCHER_V1_CONTRACT,
  VOUCHER_V2_CONTRACT,
  batchRefKey,
  candidateContracts,
  voucherContracts,
} from "@/lib/voucher/voucher-contracts";

export { VOUCHER_V1_CONTRACT, VOUCHER_V2_CONTRACT };
/** Every known gift-card contract, current first. Batch ids repeat across these. */
export const ALL_VOUCHER_CONTRACTS: readonly Address[] = voucherContracts().map((c) => c.address);

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

/** A batch on a specific contract, or on any known contract when `contract` is omitted. */
export interface BatchRef {
  batchId: number;
  contract?: string | null;
}

function getClient() {
  if (!VOUCHER_CONTRACT) return null;
  return createBasePublicClient();
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type MulticallEntry = { status: "success"; result: unknown } | { status: "failure"; error?: unknown };

/** Build a live status from raw `getBatch` / `getBatchConfig` results (config may be missing). */
export function toBatchLiveStatus(
  batchId: number,
  contractAddr: string,
  batch: readonly unknown[],
  config: readonly unknown[] | null,
  nowSec = Math.floor(Date.now() / 1000)
): BatchLiveStatus | null {
  const [creator, token, amountPerCard, cardCount, redeemedCount, message] = batch as [
    string,
    string,
    bigint,
    bigint,
    bigint,
    string,
  ];
  const count = Number(cardCount);
  if (!count) return null;

  const asset = tokenToAsset(token);
  const total = amountPerCard * BigInt(count);
  const redeemed = Number(redeemedCount);

  const unlockTimestamp = config ? Number(config[0]) : 0;
  const expirationTimestamp = config ? Number(config[1]) : 0;
  const signer = config ? String(config[2] ?? "") : "";
  const requiredSigner = signer && signer.toLowerCase() !== ZERO_ADDRESS ? signer.toLowerCase() : undefined;

  return {
    batchId,
    creator: creator.toLowerCase(),
    asset,
    totalAmount: total.toString(),
    amountPerCard: amountPerCard.toString(),
    cardCount: count,
    redeemedCount: redeemed,
    unredeemedCount: Math.max(0, count - redeemed),
    message,
    amountPerCardFormatted: formatVoucherAmount(asset, amountPerCard),
    totalAmountFormatted: formatVoucherAmount(asset, total),
    onchain: true,
    contractAddress: contractAddr.toLowerCase(),
    unlockTimestamp: unlockTimestamp || undefined,
    expirationTimestamp: expirationTimestamp || undefined,
    requiredSigner,
    isUnlocked: unlockTimestamp === 0 || nowSec >= unlockTimestamp,
    isExpired: expirationTimestamp > 0 && nowSec >= expirationTimestamp,
  };
}

/**
 * Read many batches in ONE multicall (getBatch + getBatchConfig each). A ref without a contract
 * is looked up on every known contract, so it can return several batches with the same id —
 * callers filter by creator. Batches that don't exist are left out.
 */
export async function readOnchainBatches(refs: readonly BatchRef[]): Promise<BatchLiveStatus[]> {
  const client = getClient();
  if (!client || refs.length === 0) return [];

  const pairs: Array<{ batchId: number; contract: Address }> = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    if (!Number.isInteger(ref.batchId) || ref.batchId < 1) continue;
    for (const contract of candidateContracts(ref.contract)) {
      const k = batchRefKey(contract, ref.batchId);
      if (seen.has(k)) continue;
      seen.add(k);
      pairs.push({ batchId: ref.batchId, contract });
    }
  }
  if (pairs.length === 0) return [];

  const contracts = pairs.flatMap(({ batchId, contract }) => [
    { address: contract, abi: VOUCHER_ABI, functionName: "getBatch" as const, args: [BigInt(batchId)] as const },
    { address: contract, abi: VOUCHER_ABI, functionName: "getBatchConfig" as const, args: [BigInt(batchId)] as const },
  ]);

  let results: MulticallEntry[];
  try {
    results = (await client.multicall({ contracts, allowFailure: true })) as MulticallEntry[];
  } catch {
    return [];
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const out: BatchLiveStatus[] = [];
  pairs.forEach(({ batchId, contract }, i) => {
    const b = results[i * 2];
    const cfg = results[i * 2 + 1];
    if (b?.status !== "success" || !Array.isArray(b.result)) return;
    // v1 has no getBatchConfig; treat a failed config read as "no unlock / expiry / signer".
    const config = cfg?.status === "success" && Array.isArray(cfg.result) ? cfg.result : null;
    const live = toBatchLiveStatus(batchId, contract, b.result, config, nowSec);
    if (live) out.push(live);
  });
  return out;
}

/**
 * One batch. Pass `targetContract` when known. Pass `expectedCreator` to skip same-id batches
 * on other contracts that belong to someone else (ids repeat across v1 / v2).
 */
export async function readOnchainBatch(
  batchId: number,
  targetContract?: Address,
  expectedCreator?: string
): Promise<BatchLiveStatus | null> {
  const found = await readOnchainBatches([{ batchId, contract: targetContract }]);
  const want = expectedCreator?.toLowerCase();
  return found.find((b) => !want || b.creator === want) ?? null;
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

/** Every (contract, batchId) whose onchain creator is `creator`, across all known contracts. */
async function discoverCreatorBatchRefs(creator: string): Promise<Array<{ batchId: number; contract: Address }>> {
  const client = getClient();
  if (!client) return [];

  const normalized = creator.toLowerCase();
  const refs: Array<{ batchId: number; contract: Address }> = [];

  for (const contractAddr of ALL_VOUCHER_CONTRACTS) {
    try {
      const nextId = await client.readContract({
        address: contractAddr,
        abi: VOUCHER_ABI,
        functionName: "nextBatchId",
      });
      const max = Number(nextId);
      if (max <= 1) continue;

      // Query in multicall chunks of 50
      const chunkSize = 50;
      for (let start = 1; start < max; start += chunkSize) {
        const chunk = Array.from({ length: Math.min(chunkSize, max - start) }, (_, i) => start + i);
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
                refs.push({ batchId: chunk[idx]!, contract: contractAddr });
              }
            }
          });
        } catch {
          /* skip this chunk; the next refresh retries it */
        }
      }
    } catch {
      /* RPC unavailable or contract not deployed on this network */
    }
  }

  return refs;
}

/** Batches found from deposit txs saved in the meta store (tx recovery reads the current contract). */
async function discoverBatchRefsFromStoredTxs(creator: string): Promise<Array<{ batchId: number; contract: Address }>> {
  const client = getClient();
  if (!client) return [];

  const normalized = creator.toLowerCase();
  const refs: Array<{ batchId: number; contract: Address }> = [];

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
      if (recovered) refs.push({ batchId: recovered.batchId, contract: VOUCHER_CONTRACT as Address });
    }
  } catch {
    /* ignore */
  }

  return refs;
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

/** Meta for a live batch: an exact (contract, id) match, else a legacy entry saved without a contract. */
function findMeta(metas: readonly VoucherBatchMeta[], live: BatchLiveStatus): VoucherBatchMeta | undefined {
  const contract = live.contractAddress?.toLowerCase();
  return (
    metas.find((m) => m.batchId === live.batchId && m.contractAddress?.toLowerCase() === contract) ??
    metas.find((m) => m.batchId === live.batchId && !m.contractAddress && m.creator.toLowerCase() === live.creator)
  );
}

export async function listCreatorBatches(
  creator: string,
  options?: { includeStored?: boolean; scanChain?: boolean }
): Promise<CreatorBatchSummary> {
  const normalized = creator.toLowerCase();
  const includeStored = options?.includeStored !== false;
  const scanChain = options?.scanChain !== false;

  const refs: BatchRef[] = [];
  const metas: VoucherBatchMeta[] = [];

  if (includeStored) {
    try {
      const stored = await readStoredBatches();
      const client = getClient();
      for (const b of stored) {
        if (b.creator.toLowerCase() === normalized) {
          refs.push({ batchId: b.batchId, contract: b.contractAddress });
          metas.push(b);
        } else if (b.txHash && client) {
          const { recoverBatchFromTx } = await import("@/lib/voucher/tx-recovery");
          const recovered = await recoverBatchFromTx(
            client,
            b.txHash as `0x${string}`,
            normalized
          );
          if (recovered) {
            refs.push({ batchId: recovered.batchId, contract: VOUCHER_CONTRACT });
            metas.push({
              ...b,
              batchId: recovered.batchId,
              creator: normalized,
              contractAddress: VOUCHER_CONTRACT.toLowerCase(),
            });
          }
        }
      }
    } catch {
      /* Redis optional for read path */
    }
  }

  if (scanChain) {
    refs.push(...(await discoverCreatorBatchRefs(normalized)));
    refs.push(...(await discoverBatchRefsFromStoredTxs(normalized)));
  }

  // One multicall for every batch. Ids repeat across contracts, so keep only this creator's batches.
  const seen = new Set<string>();
  const batches: BatchLiveStatus[] = [];
  for (const live of await readOnchainBatches(refs)) {
    if (live.creator !== normalized || !live.contractAddress) continue;
    const key = batchRefKey(live.contractAddress, live.batchId);
    if (seen.has(key)) continue;
    seen.add(key);
    batches.push(mergeMeta(live, findMeta(metas, live)));
  }
  batches.sort((a, b) => b.batchId - a.batchId);

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

/**
 * Live batch + per-card status. Pass `contract` to pick the batch on that contract; without it
 * the first known contract (current first) holding this id is used.
 */
export async function readBatchDetail(
  batchId: number,
  contract?: Address
): Promise<{
  batch: BatchLiveStatus | null;
  cards: BatchCardLiveStatus[];
}> {
  const batch = await readOnchainBatch(batchId, contract);
  if (!batch) return { batch: null, cards: [] };

  let meta: VoucherBatchMeta | undefined;
  try {
    meta = findMeta(await readStoredBatches(), batch);
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

  // Tx recovery only reads deposits on the current contract, so read the batch there.
  const live = await readOnchainBatch(recovered.batchId, VOUCHER_CONTRACT as Address);
  if (!live) return null;

  return {
    ...live,
    creator: wallet.toLowerCase(),
    txHash,
  };
}
