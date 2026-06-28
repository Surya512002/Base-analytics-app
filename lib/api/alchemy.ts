import { ALCHEMY_KEY, BASE_RPC } from "@/lib/constants/env";
import type { AlchemyResponse, AlchemyTransfer } from "@/lib/types/wallet";

async function fetchAssetTransferPage(
  addressField: "fromAddress" | "toAddress",
  address: string,
  pageKey?: string
): Promise<{ transfers: AlchemyTransfer[]; pageKey?: string }> {
  try {
    const params: Record<string, unknown> = {
      fromBlock: "0x0",
      toBlock: "latest",
      [addressField]: address,
      category: ["external", "internal", "erc20", "erc721", "erc1155"],
      maxCount: "0x3e8",
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
    const d = (await r.json()) as AlchemyResponse;
    return { transfers: d.result?.transfers || [], pageKey: d.result?.pageKey };
  } catch {
    return { transfers: [] };
  }
}

async function fetchAllAssetTransfers(
  addressField: "fromAddress" | "toAddress",
  address: string,
  maxPages = 12
): Promise<AlchemyTransfer[]> {
  const first = await fetchAssetTransferPage(addressField, address);
  const all = [...first.transfers];
  let nextKey = first.pageKey;
  let page = 2;
  while (nextKey && page <= maxPages) {
    const res = await fetchAssetTransferPage(addressField, address, nextKey);
    all.push(...res.transfers);
    nextKey = res.pageKey;
    page++;
  }
  return all;
}

export async function fetchAlchemyTxsFast(
  address: string
): Promise<AlchemyTransfer[]> {
  return fetchAllAssetTransfers("fromAddress", address);
}

export async function fetchAlchemyTxsIncoming(
  address: string
): Promise<AlchemyTransfer[]> {
  return fetchAllAssetTransfers("toAddress", address);
}

export async function fetchNftCount(address: string): Promise<number> {
  try {
    const r = await fetch(
      `https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${address}&withMetadata=false`
    );
    const d = await r.json();
    return d.totalCount || 0;
  } catch {
    return 0;
  }
}
