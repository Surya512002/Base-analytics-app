import { formatEther } from "ethers";
import type {
  AlchemyTransfer,
  BlockscoutInternalTx,
  BlockscoutTx,
} from "@/lib/types/wallet";

const BLOCKSCOUT_V1 = "https://base.blockscout.com/api";
const MAX_PAGES = 50;

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
      walletParticipated: true,
    },
  };
}

function mapInternalTx(tx: BlockscoutInternalTx): AlchemyTransfer {
  const eth = tx.value ? parseFloat(formatEther(tx.value)) : 0;
  return {
    hash: tx.hash,
    category: "internal",
    value: eth,
    asset: "ETH",
    to: tx.to,
    from: tx.from,
    metadata: {
      blockTimestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
      walletParticipated: true,
    },
  };
}

function mapNftTx(
  tx: BlockscoutTx & {
    tokenID?: string;
    contractAddress?: string;
    tokenName?: string;
    tokenSymbol?: string;
  }
): AlchemyTransfer {
  const contract = (tx.contractAddress || "").toLowerCase();
  const tokenId = tx.tokenID ?? "0";
  return {
    hash: tx.hash,
    category: "erc721",
    value: 1,
    asset: contract ? `${contract}#${tokenId}` : "unknown",
    to: tx.to,
    from: tx.from,
    metadata: {
      blockTimestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
      walletParticipated: true,
    },
  };
}

function mapTokenTx(
  tx: BlockscoutTx & {
    tokenSymbol?: string;
    tokenDecimal?: string;
    value?: string;
  }
): AlchemyTransfer {
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
      walletParticipated: true,
    },
  };
}

async function fetchBlockscoutPage(
  action: "txlist" | "txlistinternal" | "tokentx" | "tokennfttx",
  address: string,
  page: number,
  attempt = 0,
  pageTimeoutMs = 14_000
): Promise<BlockscoutTx[] | BlockscoutInternalTx[]> {
  const offset = action === "tokennfttx" ? 50 : 10000;
  const url = `${BLOCKSCOUT_V1}?module=account&action=${action}&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=${offset}&sort=desc`;
  try {
    const r = await fetch(url, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(pageTimeoutMs),
    });
    const data = (await r.json()) as {
      status?: string;
      message?: string;
      result?: unknown;
    };

    const ok =
      data.message === "OK" ||
      data.status === "1" ||
      data.status === "success";
    if (!ok || !data.result) {
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
        return fetchBlockscoutPage(action, address, page, attempt + 1, pageTimeoutMs);
      }
      return [];
    }

    if (!Array.isArray(data.result)) return [];
    if (typeof data.result[0] === "string") {
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        return fetchBlockscoutPage(action, address, page, attempt + 1, pageTimeoutMs);
      }
      return [];
    }
    return data.result as BlockscoutTx[] | BlockscoutInternalTx[];
  } catch {
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      return fetchBlockscoutPage(action, address, page, attempt + 1, pageTimeoutMs);
    }
    return [];
  }
}

/** Fetch pages in small batches to avoid Blockscout rate limits. */
async function fetchAllPages(
  action: "txlist" | "txlistinternal" | "tokentx" | "tokennfttx",
  address: string,
  maxPages = MAX_PAGES,
  deadlineMs = 0,
  pageTimeoutMs = 14_000
): Promise<(BlockscoutTx | BlockscoutInternalTx)[]> {
  const started = Date.now();
  const bounded = deadlineMs > 0;
  const pageSize = action === "tokennfttx" ? 50 : 10000;
  const all: (BlockscoutTx | BlockscoutInternalTx)[] = [];
  const batchSize = action === "tokennfttx" ? 2 : 5;

  for (let page = 1; page <= maxPages; page += batchSize) {
    if (bounded && page > 1 && Date.now() - started >= deadlineMs) break;

    const pages = Array.from(
      { length: Math.min(batchSize, maxPages - page + 1) },
      (_, i) => page + i
    );
    const chunks = await Promise.all(
      pages.map((p) =>
        fetchBlockscoutPage(action, address, p, 0, pageTimeoutMs)
      )
    );

    let stop = false;
    for (const rows of chunks) {
      if (!rows.length) {
        stop = true;
        break;
      }
      all.push(...rows);
      if (rows.length < pageSize) {
        stop = true;
        break;
      }
    }
    if (stop) break;
    if (page + batchSize <= maxPages) {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
  return all;
}

export interface BlockscoutV1Options {
  maxPages?: number;
  deadlineMs?: number;
  pageTimeoutMs?: number;
}

export async function fetchBlockscoutTxs(
  address: string,
  options: BlockscoutV1Options = {}
): Promise<AlchemyTransfer[]> {
  try {
    const rows = await fetchAllPages(
      "txlist",
      address,
      options.maxPages ?? MAX_PAGES,
      options.deadlineMs ?? 0,
      options.pageTimeoutMs ?? 14_000
    );
    return (rows as BlockscoutTx[]).map(mapBlockscoutTx);
  } catch {
    return [];
  }
}

export async function fetchBlockscoutInternalTxs(
  address: string,
  options: BlockscoutV1Options = {}
): Promise<AlchemyTransfer[]> {
  try {
    const rows = await fetchAllPages(
      "txlistinternal",
      address,
      options.maxPages ?? MAX_PAGES,
      options.deadlineMs ?? 0,
      options.pageTimeoutMs ?? 14_000
    );
    return (rows as BlockscoutInternalTx[]).map(mapInternalTx);
  } catch {
    return [];
  }
}

export async function fetchBlockscoutTokenTxs(
  address: string,
  options: BlockscoutV1Options = {}
): Promise<AlchemyTransfer[]> {
  try {
    const rows = await fetchAllPages(
      "tokentx",
      address,
      options.maxPages ?? MAX_PAGES,
      options.deadlineMs ?? 0,
      options.pageTimeoutMs ?? 14_000
    );
    return (rows as BlockscoutTx[]).map(mapTokenTx);
  } catch {
    return [];
  }
}

export async function fetchBlockscoutNftTxs(
  address: string,
  options: BlockscoutV1Options = {}
): Promise<AlchemyTransfer[]> {
  try {
    const rows = await fetchAllPages(
      "tokennfttx",
      address,
      options.maxPages ?? MAX_PAGES,
      options.deadlineMs ?? 0
    );
    return (rows as BlockscoutTx[]).map(mapNftTx);
  } catch {
    return [];
  }
}

/** v1 bulk fetch — 10k rows/page, all four streams in parallel. */
export async function fetchBlockscoutV1Full(
  address: string
): Promise<AlchemyTransfer[]> {
  const [txs, internals, tokens, nfts] = await Promise.all([
    fetchBlockscoutTxs(address),
    fetchBlockscoutInternalTxs(address),
    fetchBlockscoutTokenTxs(address),
    fetchBlockscoutNftTxs(address),
  ]);
  return [...txs, ...internals, ...tokens, ...nfts];
}
