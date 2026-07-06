import { formatEther } from "ethers";
import type { AlchemyTransfer, BlockscoutTx } from "@/lib/types/wallet";

const BASE_CHAIN_ID = 8453;

type BasescanAction = "txlist" | "tokentx" | "txlistinternal";

function basescanUrl(apiKey: string, params: Record<string, string>): string {
  const q = new URLSearchParams({
    chainid: String(BASE_CHAIN_ID),
    ...params,
    apikey: apiKey,
  });
  return `https://api.etherscan.io/v2/api?${q.toString()}`;
}

function mapExternal(tx: BlockscoutTx): AlchemyTransfer {
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

function mapToken(
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

function mapInternal(tx: BlockscoutTx): AlchemyTransfer {
  return {
    hash: tx.hash,
    category: "internal",
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

async function fetchBasescanAction(
  action: BasescanAction,
  address: string,
  apiKey: string,
  maxPages = 20,
  deadlineMs = 18_000
): Promise<AlchemyTransfer[]> {
  if (!apiKey) return [];

  const all: AlchemyTransfer[] = [];
  const started = Date.now();

  for (let page = 1; page <= maxPages; page++) {
    if (page > 1 && Date.now() - started >= deadlineMs) break;

    try {
      const url = basescanUrl(apiKey, {
        module: "account",
        action,
        address,
        startblock: "0",
        endblock: "99999999",
        page: String(page),
        offset: "10000",
        sort: "desc",
      });
      const r = await fetch(url, {
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(12_000),
      });
      const data = await r.json();
      const rows = data?.result;
      if (!Array.isArray(rows) || rows.length === 0) break;
      if (typeof rows[0] === "string") break;

      if (action === "txlist") {
        all.push(...(rows as BlockscoutTx[]).map(mapExternal));
      } else if (action === "tokentx") {
        all.push(...(rows as BlockscoutTx[]).map(mapToken));
      } else {
        all.push(...(rows as BlockscoutTx[]).map(mapInternal));
      }

      if (rows.length < 10000) break;
    } catch {
      break;
    }
  }

  return all;
}

export async function fetchBasescanTxs(
  address: string,
  apiKey: string,
  maxPages = 20,
  deadlineMs = 18_000
): Promise<AlchemyTransfer[]> {
  return fetchBasescanAction("txlist", address, apiKey, maxPages, deadlineMs);
}

export async function fetchBasescanTokenTxs(
  address: string,
  apiKey: string,
  maxPages = 20,
  deadlineMs = 18_000
): Promise<AlchemyTransfer[]> {
  return fetchBasescanAction("tokentx", address, apiKey, maxPages, deadlineMs);
}

export async function fetchBasescanInternalTxs(
  address: string,
  apiKey: string,
  maxPages = 15,
  deadlineMs = 15_000
): Promise<AlchemyTransfer[]> {
  return fetchBasescanAction(
    "txlistinternal",
    address,
    apiKey,
    maxPages,
    deadlineMs
  );
}

/** All Basescan streams in parallel (fast supplement to Blockscout). */
export async function fetchBasescanAll(
  address: string,
  apiKey: string
): Promise<AlchemyTransfer[]> {
  const [txs, tokens, internals] = await Promise.all([
    fetchBasescanTxs(address, apiKey),
    fetchBasescanTokenTxs(address, apiKey),
    fetchBasescanInternalTxs(address, apiKey),
  ]);
  return [...txs, ...tokens, ...internals];
}

export function getBasescanApiKey(): string {
  return getBasescanApiKeys()[0] || "";
}

export function getBasescanApiKeys(): string[] {
  const keys: string[] = [];
  const add = (raw: string | undefined) => {
    const t = (raw || "").replace(/^["']|["']$/g, "").trim();
    if (t && !keys.includes(t)) keys.push(t);
  };
  for (const part of (process.env.BASESCAN_API_KEYS || "").split(",")) {
    add(part);
  }
  add(process.env.BASESCAN_API_KEY);
  add(process.env.NEXT_PUBLIC_BASESCAN_API_KEY);
  add(process.env.ETHERSCAN_API_KEY);
  return keys;
}

/** Parallel Basescan streams — each action can use a different API key. */
export async function fetchBasescanAllFast(
  address: string,
  deadlineMs = 10_000,
  maxPages = 4
): Promise<AlchemyTransfer[]> {
  const keys = getBasescanApiKeys();
  if (!keys.length) return [];
  const [txs, tokens, internals] = await Promise.all([
    fetchBasescanTxs(address, keys[0], maxPages, deadlineMs),
    fetchBasescanTokenTxs(
      address,
      keys[keys.length > 1 ? 1 : 0],
      maxPages,
      deadlineMs
    ),
    fetchBasescanInternalTxs(
      address,
      keys[keys.length > 2 ? 2 : 0],
      Math.min(maxPages, 3),
      deadlineMs
    ),
  ]);
  return [...txs, ...tokens, ...internals];
}
