import { formatEther } from "ethers";
import type { AlchemyTransfer, BlockscoutTx } from "@/lib/types/wallet";

const BASE_CHAIN_ID = 8453;

type BasescanAction = "txlist" | "tokentx" | "txlistinternal" | "aatxlist";

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

/** Map Basescan AA / Other Transactions rows when the API exposes them. */
function mapAaTx(row: Record<string, unknown>): AlchemyTransfer | null {
  const hash = String(
    row.hash || row.transactionHash || row.userOpHash || row.userOperationHash || ""
  );
  if (!hash || hash === "undefined") return null;
  const userOpHash = String(
    row.userOpHash || row.userOperationHash || row.hash || ""
  ).toLowerCase();
  const ts = Number(row.timeStamp || row.timestamp || 0);
  const from = String(row.from || row.sender || "").toLowerCase() || null;
  const to = String(row.to || row.entryPoint || row.entrypoint || "").toLowerCase() || null;
  const paymaster = String(row.paymaster || "").toLowerCase();
  const sponsored =
    Boolean(paymaster) &&
    paymaster !== "0x0000000000000000000000000000000000000000";

  return {
    hash,
    category: "useroperation",
    value: 0,
    asset: "ETH",
    from,
    to,
    metadata: {
      blockTimestamp: ts
        ? new Date(ts * 1000).toISOString()
        : new Date().toISOString(),
      isUserOperation: true,
      isSponsored: sponsored,
      userOpHash: userOpHash || undefined,
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
      } else if (action === "aatxlist") {
        for (const row of rows as Record<string, unknown>[]) {
          const mapped = mapAaTx(row);
          if (mapped) all.push(mapped);
        }
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

/**
 * Basescan AA / Other Transactions for an address.
 * Uses action `aatxlist` when the plan exposes it; returns [] otherwise
 * (UI AA tab has no free public action on all plans — EntryPoint logs fill the gap).
 */
export async function fetchBasescanAaTxs(
  address: string,
  apiKey: string,
  maxPages = 10,
  deadlineMs = 12_000
): Promise<AlchemyTransfer[]> {
  return fetchBasescanAction("aatxlist", address, apiKey, maxPages, deadlineMs);
}

/** All Basescan streams in parallel (fast supplement to Blockscout + AA). */
export async function fetchBasescanAll(
  address: string,
  apiKey: string
): Promise<AlchemyTransfer[]> {
  const [txs, tokens, internals, aa] = await Promise.all([
    fetchBasescanTxs(address, apiKey),
    fetchBasescanTokenTxs(address, apiKey),
    fetchBasescanInternalTxs(address, apiKey),
    fetchBasescanAaTxs(address, apiKey),
  ]);
  return [...txs, ...tokens, ...internals, ...aa];
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
  const k0 = keys[0];
  const k1 = keys[keys.length > 1 ? 1 : 0];
  const k2 = keys[keys.length > 2 ? 2 : 0];
  const k3 = keys[keys.length > 3 ? 3 : 0];
  const [txs, tokens, internals, aa] = await Promise.all([
    fetchBasescanTxs(address, k0, maxPages, deadlineMs),
    fetchBasescanTokenTxs(address, k1, maxPages, deadlineMs),
    fetchBasescanInternalTxs(
      address,
      k2,
      Math.min(maxPages, 3),
      deadlineMs
    ),
    fetchBasescanAaTxs(address, k3, Math.min(maxPages, 6), deadlineMs),
  ]);
  return [...txs, ...tokens, ...internals, ...aa];
}
