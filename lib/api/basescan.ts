import { formatEther } from "ethers";
import type { AlchemyTransfer, BlockscoutTx } from "@/lib/types/wallet";

const BASE_CHAIN_ID = 8453;

function basescanUrl(apiKey: string, params: Record<string, string>): string {
  const q = new URLSearchParams({
    chainid: String(BASE_CHAIN_ID),
    ...params,
    apikey: apiKey,
  });
  return `https://api.etherscan.io/v2/api?${q.toString()}`;
}

function mapBasescanTx(tx: BlockscoutTx): AlchemyTransfer {
  return {
    hash: tx.hash,
    category: "external",
    value: tx.value ? parseFloat(formatEther(tx.value)) : 0,
    asset: "ETH",
    to: tx.to,
    from: tx.from,
    metadata: {
      blockTimestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
    },
  };
}

/** Server-side Basescan tx list (Etherscan API v2 for Base). */
export async function fetchBasescanTxs(
  address: string,
  apiKey: string,
  maxPages = 10
): Promise<AlchemyTransfer[]> {
  if (!apiKey) return [];

  const all: AlchemyTransfer[] = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = basescanUrl(apiKey, {
        module: "account",
        action: "txlist",
        address,
        startblock: "0",
        endblock: "99999999",
        page: String(page),
        offset: "10000",
        sort: "desc",
      });
      const r = await fetch(url, { next: { revalidate: 0 } });
      const data = await r.json();
      const rows = data?.result;
      if (!Array.isArray(rows) || rows.length === 0) break;
      if (typeof rows[0] === "string") break; // API error message
      all.push(...(rows as BlockscoutTx[]).map(mapBasescanTx));
      if (rows.length < 10000) break;
    } catch {
      break;
    }
  }
  return all;
}
