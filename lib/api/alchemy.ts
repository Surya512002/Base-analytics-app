import { ALCHEMY_KEY, BASE_RPC } from "@/lib/constants/env";
import type { AlchemyResponse, AlchemyTransfer } from "@/lib/types/wallet";

const PAGE_SIZE = "0x3e8"; // 1000 — Alchemy max per page
const DEFAULT_MAX_PAGES = 80;
const PAGE_RETRIES = 3;

async function fetchAssetTransferPage(
  addressField: "fromAddress" | "toAddress",
  address: string,
  pageKey?: string
): Promise<{ transfers: AlchemyTransfer[]; pageKey?: string }> {
  for (let attempt = 0; attempt < PAGE_RETRIES; attempt++) {
    try {
      const params: Record<string, unknown> = {
        fromBlock: "0x0",
        toBlock: "latest",
        [addressField]: address,
        category: ["external", "internal", "erc20", "erc721", "erc1155"],
        maxCount: PAGE_SIZE,
        withMetadata: true,
        excludeZeroValue: false,
      };
      if (pageKey) params.pageKey = pageKey;
      const r = await fetch(BASE_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getAssetTransfers",
          params: [params],
        }),
      });
      if (!r.ok) continue;
      const d = (await r.json()) as AlchemyResponse & { error?: unknown };
      if (d.error) continue;
      return { transfers: d.result?.transfers || [], pageKey: d.result?.pageKey };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  return { transfers: [] };
}

/** Paginate until exhausted (or safety cap) — keeps oldest→newest via order asc. */
async function fetchAllAssetTransfers(
  addressField: "fromAddress" | "toAddress",
  address: string,
  maxPages = DEFAULT_MAX_PAGES
): Promise<AlchemyTransfer[]> {
  const first = await fetchAssetTransferPage(addressField, address);
  const all = [...first.transfers];
  let nextKey = first.pageKey;
  let page = 2;

  while (nextKey && page <= maxPages) {
    const res = await fetchAssetTransferPage(addressField, address, nextKey);
    if (res.transfers.length === 0 && res.pageKey) {
      // Stuck pagination — stop to avoid infinite loop
      break;
    }
    all.push(...res.transfers);
    nextKey = res.pageKey;
    page++;
  }

  return all;
}

export async function fetchAlchemyTxsFast(
  address: string,
  maxPages = DEFAULT_MAX_PAGES
): Promise<AlchemyTransfer[]> {
  return fetchAllAssetTransfers("fromAddress", address, maxPages);
}

export async function fetchAlchemyTxsIncoming(
  address: string,
  maxPages = DEFAULT_MAX_PAGES
): Promise<AlchemyTransfer[]> {
  return fetchAllAssetTransfers("toAddress", address, maxPages);
}

export async function fetchNftCount(address: string): Promise<number> {
  try {
    if (!ALCHEMY_KEY) return 0;
    const r = await fetch(
      `https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${address}&withMetadata=false`
    );
    const d = await r.json();
    return d.totalCount || 0;
  } catch {
    return 0;
  }
}
