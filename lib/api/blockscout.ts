import { formatEther } from "ethers";
import type {
  AlchemyTransfer,
  BlockscoutInternalTx,
  BlockscoutTx,
} from "@/lib/types/wallet";

function mapBlockscoutTx(tx: BlockscoutTx): AlchemyTransfer {
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

function mapInternalTx(tx: BlockscoutInternalTx): AlchemyTransfer {
  return {
    hash: tx.hash,
    category: "internal",
    value: tx.value ? parseFloat(formatEther(tx.value)) : 0,
    asset: "ETH",
    to: tx.to,
    from: tx.from,
    metadata: {
      blockTimestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
    },
  };
}

async function fetchBlockscoutPage(
  action: "txlist" | "txlistinternal",
  address: string,
  page: number
): Promise<BlockscoutTx[] | BlockscoutInternalTx[]> {
  const r = await fetch(
    `https://base.blockscout.com/api?module=account&action=${action}&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=10000&sort=desc`
  );
  const data = await r.json();
  if (!data.result || !Array.isArray(data.result)) return [];
  return data.result;
}

export async function fetchBlockscoutTxs(
  address: string,
  maxPages = 10
): Promise<AlchemyTransfer[]> {
  try {
    const all: AlchemyTransfer[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const rows = await fetchBlockscoutPage("txlist", address, page);
      if (!rows.length) break;
      all.push(...(rows as BlockscoutTx[]).map(mapBlockscoutTx));
      if (rows.length < 10000) break;
    }
    return all;
  } catch {
    return [];
  }
}

export async function fetchBlockscoutInternalTxs(
  address: string,
  maxPages = 5
): Promise<AlchemyTransfer[]> {
  try {
    const all: AlchemyTransfer[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const rows = await fetchBlockscoutPage("txlistinternal", address, page);
      if (!rows.length) break;
      all.push(...(rows as BlockscoutInternalTx[]).map(mapInternalTx));
      if (rows.length < 10000) break;
    }
    return all;
  } catch {
    return [];
  }
}
