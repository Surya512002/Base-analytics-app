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
  action: "txlist" | "txlistinternal" | "tokentx",
  address: string,
  page: number
): Promise<BlockscoutTx[] | BlockscoutInternalTx[]> {
  const r = await fetch(
    `https://base.blockscout.com/api?module=account&action=${action}&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=10000&sort=asc`
  );
  const data = await r.json();
  if (!data.result || !Array.isArray(data.result)) return [];
  return data.result;
}

function mapTokenTx(tx: BlockscoutTx & { tokenSymbol?: string; tokenDecimal?: string; value?: string }): AlchemyTransfer {
  const decimals = parseInt(tx.tokenDecimal || "18", 10) || 18;
  let value = 0;
  try {
    value = Number(tx.value || "0") / 10 ** decimals;
  } catch {
    value = 0;
  }
  return {
    hash: tx.hash,
    category: "erc20",
    value,
    asset: tx.tokenSymbol || "TOKEN",
    to: tx.to,
    from: tx.from,
    metadata: {
      blockTimestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
    },
  };
}

export async function fetchBlockscoutTxs(
  address: string,
  maxPages = 30
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
  maxPages = 20
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

export async function fetchBlockscoutTokenTxs(
  address: string,
  maxPages = 30
): Promise<AlchemyTransfer[]> {
  try {
    const all: AlchemyTransfer[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const rows = await fetchBlockscoutPage("tokentx", address, page);
      if (!rows.length) break;
      all.push(...(rows as BlockscoutTx[]).map(mapTokenTx));
      if (rows.length < 10000) break;
    }
    return all;
  } catch {
    return [];
  }
}
