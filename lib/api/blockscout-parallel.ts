import type { AlchemyTransfer } from "@/lib/types/wallet";
import {
  fetchBlockscoutNftTxs,
  fetchBlockscoutTokenTxs,
  fetchBlockscoutInternalTxs,
  fetchBlockscoutTxs,
} from "@/lib/api/blockscout";

const BLOCKSCOUT_V1 = "https://base.blockscout.com/api";

type V1Action = "txlist" | "txlistinternal" | "tokentx" | "tokennfttx";

/** Fetch one Blockscout v1 page (used for parallel fan-out). */
async function fetchV1Page(
  action: V1Action,
  address: string,
  page: number
): Promise<unknown[]> {
  const url = `${BLOCKSCOUT_V1}?module=account&action=${action}&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=10000&sort=desc`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    const data = (await r.json()) as { result?: unknown[] };
    if (!data.result || !Array.isArray(data.result)) return [];
    if (typeof data.result[0] === "string") return [];
    return data.result;
  } catch {
    return [];
  }
}

/** Priority NFT bundle — always fetched with generous timeout. */
export async function fetchBlockscoutNftBundle(
  address: string,
  pages = 5
): Promise<AlchemyTransfer[]> {
  return fetchBlockscoutNftTxs(address, {
    deadlineMs: 18_000,
    maxPages: pages,
  }).catch(() => []);
}

/** Fast parallel snapshot: NFT + recent tokens + internals for score preview. */
export async function fetchBlockscoutQuickSnapshot(
  address: string
): Promise<AlchemyTransfer[]> {
  const addr = address.toLowerCase();
  const [nfts, tokens, internals, txs] = await Promise.all([
    fetchBlockscoutNftBundle(addr, 5),
    fetchBlockscoutTokenTxs(addr, { deadlineMs: 10_000, maxPages: 3 }),
    fetchBlockscoutInternalTxs(addr, { deadlineMs: 10_000, maxPages: 3 }),
    fetchBlockscoutTxs(addr, { deadlineMs: 8_000, maxPages: 2 }),
  ]);
  return [...nfts, ...tokens, ...internals, ...txs];
}
