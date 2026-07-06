import { getAddress } from "viem";

import type { AlchemyTransfer } from "@/lib/types/wallet";
import { fetchBlockscoutNftTxs } from "@/lib/api/blockscout";

const BLOCKSCOUT_V2 = "https://base.blockscout.com/api/v2";

function pathAddr(address: string): string {
  try {
    return getAddress(address);
  } catch {
    return address;
  }
}

export interface NftMetricsOptions {
  maxPages?: number;
  deadlineMs?: number;
}

/** NFTs currently held — Blockscout v2 /nft (paginated). */
export async function fetchBlockscoutNftHoldingsCount(
  address: string,
  options: NftMetricsOptions = {}
): Promise<number> {
  const maxPages = options.maxPages ?? 12;
  const deadlineMs = options.deadlineMs ?? 14_000;
  const started = Date.now();
  const path = pathAddr(address);

  let total = 0;
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    if (page > 0 && Date.now() - started >= deadlineMs) break;

    try {
      const url = cursor
        ? `${BLOCKSCOUT_V2}/addresses/${path}/nft?${cursor}`
        : `${BLOCKSCOUT_V2}/addresses/${path}/nft`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) break;

      const data = (await res.json()) as {
        items?: unknown[];
        next_page_params?: Record<string, string | number | null> | null;
      };
      total += Array.isArray(data.items) ? data.items.length : 0;

      const npp = data.next_page_params;
      if (!npp) break;
      cursor = new URLSearchParams(
        Object.entries(npp).map(([k, v]) => [k, String(v ?? "")])
      ).toString();
    } catch {
      break;
    }
  }

  return total;
}

/** Unique tx hashes with NFT mint / transfer activity (v1 tokennfttx). */
export async function fetchBlockscoutNftTxHashCount(
  address: string,
  options: NftMetricsOptions = {}
): Promise<number> {
  const transfers = await fetchBlockscoutNftTxs(address.toLowerCase(), {
    maxPages: options.maxPages ?? 12,
    deadlineMs: options.deadlineMs ?? 14_000,
  }).catch(() => [] as AlchemyTransfer[]);

  const hashes = new Set<string>();
  for (const tx of transfers) {
    if (tx.hash) hashes.add(tx.hash.toLowerCase());
  }
  return hashes.size;
}

/** @deprecated Prefer fetchBlockscoutNftTxHashCount (v1 tokennfttx). */
export async function fetchBlockscoutNftTxHashCountV2(
  address: string,
  options: NftMetricsOptions = {}
): Promise<number> {
  const maxPages = options.maxPages ?? 10;
  const deadlineMs = options.deadlineMs ?? 14_000;
  const started = Date.now();
  const path = pathAddr(address);
  const hashes = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    if (page > 0 && Date.now() - started >= deadlineMs) break;

    try {
      const url = cursor
        ? `${BLOCKSCOUT_V2}/addresses/${path}/token-transfers?${cursor}`
        : `${BLOCKSCOUT_V2}/addresses/${path}/token-transfers`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) break;

      const data = (await res.json()) as {
        items?: { token?: { type?: string }; transaction_hash?: string }[];
        next_page_params?: Record<string, string | number | null> | null;
      };
      if (!Array.isArray(data.items)) break;

      for (const it of data.items) {
        const t = (it.token?.type || "").toUpperCase();
        if (t.includes("721") || t.includes("1155")) {
          if (it.transaction_hash) hashes.add(it.transaction_hash.toLowerCase());
        }
      }

      const npp = data.next_page_params;
      if (!npp) break;
      cursor = new URLSearchParams(
        Object.entries(npp).map(([k, v]) => [k, String(v ?? "")])
      ).toString();
    } catch {
      break;
    }
  }

  return hashes.size;
}
