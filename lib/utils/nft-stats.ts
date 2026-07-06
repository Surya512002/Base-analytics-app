import { ALCHEMY_KEY, getAlchemyKeys } from "@/lib/constants/env";
import type { AlchemyTransfer } from "@/lib/types/wallet";
import {
  countsTowardActivity,
  walletInvolved,
} from "@/lib/utils/wallet-activity";
import { fetchBlockscoutNftHoldingsCount } from "@/lib/api/blockscout-nft-metrics";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export function isNftCategory(category: string): boolean {
  return category === "erc721" || category === "erc1155";
}

export function isNftMint(tx: AlchemyTransfer): boolean {
  return (tx.from || "").toLowerCase() === ZERO_ADDR;
}

/** Unique NFT assets touched (mint, receive, transfer) from indexed history. */
export function countNftActivityFromTransfers(
  allTxs: AlchemyTransfer[],
  walletAddress: string
): number {
  const addr = walletAddress.toLowerCase();
  const keys = new Set<string>();

  for (const tx of allTxs) {
    if (!isNftCategory(tx.category)) continue;
    if (!countsTowardActivity(tx, addr)) continue;
    if (!walletInvolved(tx, addr) && !tx.metadata?.walletParticipated) continue;

    const asset = (tx.asset || "unknown").toLowerCase();
    keys.add(asset);
  }

  return keys.size;
}

/** Unique tx hashes with NFT activity (mints, transfers, receives). */
export function countNftTxHashesFromTransfers(
  allTxs: AlchemyTransfer[],
  walletAddress: string
): { uniqueHashes: number; mintHashes: number } {
  const addr = walletAddress.toLowerCase();
  const hashes = new Set<string>();
  const mints = new Set<string>();

  for (const tx of allTxs) {
    if (!isNftCategory(tx.category)) continue;
    if (!countsTowardActivity(tx, addr)) continue;
    if (!walletInvolved(tx, addr) && !tx.metadata?.walletParticipated) continue;

    hashes.add(tx.hash);
    if (isNftMint(tx)) mints.add(tx.hash);
  }

  return { uniqueHashes: hashes.size, mintHashes: mints.size };
}

/** Estimate holdings from transfer history when Alchemy NFT API is unavailable. */
export function estimateNftHoldingsFromTransfers(
  allTxs: AlchemyTransfer[],
  walletAddress: string
): number {
  const addr = walletAddress.toLowerCase();
  const net = new Map<string, number>();

  for (const tx of allTxs) {
    if (!isNftCategory(tx.category)) continue;
    const key = (tx.asset || "").toLowerCase();
    if (!key || key === "unknown") continue;

    const from = (tx.from || "").toLowerCase();
    const to = (tx.to || "").toLowerCase();
    const qty =
      tx.category === "erc1155" ? Math.max(1, tx.value ?? 1) : 1;

    if (to === addr) net.set(key, (net.get(key) || 0) + qty);
    if (from === addr) net.set(key, (net.get(key) || 0) - qty);
  }

  let held = 0;
  for (const balance of net.values()) {
    if (balance > 0) held++;
  }
  return held;
}

/** NFTs currently held — Alchemy with transfer-history fallback. */
export async function resolveNftCount(
  address: string,
  allTxs: AlchemyTransfer[] = []
): Promise<number> {
  const fromTransfers = countNftActivityFromTransfers(allTxs, address);
  const fromHoldings = estimateNftHoldingsFromTransfers(allTxs, address);
  const fromApi = await fetchNftHoldingsCount(address);
  return Math.max(fromApi, fromTransfers, fromHoldings);
}

/** Fast Alchemy NFT count (single request, uses totalCount). */
export async function fetchAlchemyNftTotalCount(
  address: string
): Promise<number> {
  const key = getAlchemyKeys()[0] || ALCHEMY_KEY;
  if (!key) return 0;

  try {
    const r = await fetch(
      `https://base-mainnet.g.alchemy.com/nft/v3/${key}/getNFTsForOwner?owner=${address}&withMetadata=false&pageSize=1`,
      { signal: AbortSignal.timeout(12_000) }
    );
    if (!r.ok) return 0;
    const d = (await r.json()) as {
      totalCount?: number;
      ownedNfts?: unknown[];
    };
    const total = Number(d.totalCount);
    if (Number.isFinite(total) && total > 0) return total;
    return Array.isArray(d.ownedNfts) ? d.ownedNfts.length : 0;
  } catch {
    return 0;
  }
}

/** NFTs currently held — Blockscout v2 first, Alchemy fallback. */
export async function fetchNftHoldingsCount(address: string): Promise<number> {
  const [blockscout, alchemy] = await Promise.all([
    fetchBlockscoutNftHoldingsCount(address, {
      maxPages: 12,
      deadlineMs: 16_000,
    }).catch(() => 0),
    fetchAlchemyNftTotalCount(address).catch(() => 0),
  ]);
  return Math.max(blockscout, alchemy);
}
