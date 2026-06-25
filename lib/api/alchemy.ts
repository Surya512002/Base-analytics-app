import { ALCHEMY_KEY, BASE_RPC } from "@/lib/constants/env";
import type { AlchemyResponse, AlchemyTransfer } from "@/lib/types/wallet";

export async function fetchAlchemyTxsFast(
  address: string
): Promise<AlchemyTransfer[]> {
  const fetchPage = async (
    pageKey?: string
  ): Promise<{ transfers: AlchemyTransfer[]; pageKey?: string }> => {
    try {
      const params: Record<string, unknown> = {
        fromBlock: "0x0",
        toBlock: "latest",
        fromAddress: address,
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
  };

  const first = await fetchPage();
  const all = [...first.transfers];
  if (!first.pageKey) return all;

  let nextKey: string | undefined = first.pageKey;
  let page = 2;
  while (nextKey && page <= 8) {
    const res = await fetchPage(nextKey);
    all.push(...res.transfers);
    nextKey = res.pageKey;
    page++;
  }
  return all;
}

export async function fetchAlchemyTxsIncoming(
  address: string
): Promise<AlchemyTransfer[]> {
  try {
    const r = await fetch(BASE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            toAddress: address,
            category: ["external", "internal", "erc20", "erc721", "erc1155"],
            maxCount: "0x3e8",
            withMetadata: true,
            excludeZeroValue: false,
          },
        ],
      }),
    });
    const d = (await r.json()) as AlchemyResponse;
    return d.result?.transfers || [];
  } catch {
    return [];
  }
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
