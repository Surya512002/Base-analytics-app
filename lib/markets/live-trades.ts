/**
 * Recent on-chain trades for Base pools, read from GeckoTerminal's public API.
 * Used by Explore's live feed and the Swap "Recent trades" list. Read-only, cached briefly
 * per pool so many visitors share one upstream call (GeckoTerminal allows ~30 calls/min).
 */

const GT = "https://api.geckoterminal.com/api/v2/networks/base";
const TRADES_TTL_MS = 45_000;
/** After a 429 from GeckoTerminal, stop calling it for this long and serve cached data. */
const BACKOFF_MS = 60_000;
let backoffUntil = 0;
const POOL_TTL_MS = 5 * 60_000;
const TIMEOUT_MS = 6_000;

export type LiveTrade = {
  id: string;
  pool: string;
  txHash: string;
  wallet: string;
  kind: "buy" | "sell";
  usd: number;
  tokenAmount: number;
  priceUsd: number;
  /** Unix ms. */
  timestamp: number;
};

/** Pool ids: v2/v3 pools are 20-byte addresses; Uniswap v4 pools are 32-byte ids. */
export function isPoolId(value: string): boolean {
  return /^0x(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
}

export function isTokenAddress(value: string): boolean {
  return /^0x[a-f0-9]{40}$/.test(value);
}

type GtTrade = {
  id?: string;
  attributes?: {
    block_timestamp?: string;
    tx_hash?: string;
    tx_from_address?: string;
    kind?: string;
    volume_in_usd?: string;
    from_token_amount?: string;
    to_token_amount?: string;
    price_from_in_usd?: string;
    price_to_in_usd?: string;
    is_anomalous?: boolean;
  };
};

const num = (v: string | undefined) => {
  const n = v ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

/** Normalize GeckoTerminal trade rows. Rows missing a hash, kind or time are dropped. */
export function parseGeckoTrades(pool: string, rows: unknown): LiveTrade[] {
  if (!Array.isArray(rows)) return [];
  const out: LiveTrade[] = [];
  for (const row of rows as GtTrade[]) {
    const a = row?.attributes;
    const kind = a?.kind === "buy" || a?.kind === "sell" ? a.kind : null;
    const txHash = a?.tx_hash ?? "";
    const ts = a?.block_timestamp ? Date.parse(a.block_timestamp) : NaN;
    if (a?.is_anomalous) continue;
    if (!kind || !/^0x[a-fA-F0-9]{64}$/.test(txHash) || !Number.isFinite(ts)) continue;
    // On a buy the pool's base token is what the trader received; on a sell, what they paid.
    const tokenAmount = kind === "buy" ? num(a?.to_token_amount) : num(a?.from_token_amount);
    const priceUsd = kind === "buy" ? num(a?.price_to_in_usd) : num(a?.price_from_in_usd);
    out.push({
      id: row.id ?? `${txHash}-${out.length}`,
      pool,
      txHash,
      wallet: (a?.tx_from_address ?? "").toLowerCase(),
      kind,
      usd: num(a?.volume_in_usd),
      tokenAmount,
      priceUsd,
      timestamp: ts,
    });
  }
  return out;
}

const tradeCache = new Map<string, { at: number; trades: LiveTrade[] }>();
const poolCache = new Map<string, { at: number; pool: string | null }>();

async function getJson(url: string): Promise<unknown> {
  if (Date.now() < backoffUntil) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (res.status === 429) {
      backoffUntil = Date.now() + BACKOFF_MS;
      return null;
    }
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPoolTrades(pool: string): Promise<LiveTrade[]> {
  const key = pool.toLowerCase();
  const hit = tradeCache.get(key);
  if (hit && Date.now() - hit.at < TRADES_TTL_MS) return hit.trades;
  const json = (await getJson(`${GT}/pools/${key}/trades`)) as { data?: unknown } | null;
  const trades = json ? parseGeckoTrades(key, json.data) : hit?.trades ?? [];
  if (json) tradeCache.set(key, { at: Date.now(), trades });
  return trades;
}

/** Most active pool for a token (GeckoTerminal orders pools by volume and liquidity). */
export async function topPoolForToken(token: string): Promise<string | null> {
  const key = token.toLowerCase();
  const hit = poolCache.get(key);
  if (hit && Date.now() - hit.at < POOL_TTL_MS) return hit.pool;
  const json = (await getJson(`${GT}/tokens/${key}/pools?page=1`)) as {
    data?: Array<{
      attributes?: { address?: string };
      relationships?: { base_token?: { data?: { id?: string } } };
    }>;
  } | null;
  // Only pools where this token is the base side, so "buy" / "sell" mean buying / selling it.
  const match = json?.data?.find((p) => p.relationships?.base_token?.data?.id?.toLowerCase() === `base_${key}`);
  const addr = match?.attributes?.address?.toLowerCase() ?? null;
  const pool = addr && isPoolId(addr) ? addr : null;
  if (json) poolCache.set(key, { at: Date.now(), pool });
  return pool;
}

/** Merge several pools' trades, newest first. */
export function mergeTrades(lists: LiveTrade[][], limit: number): LiveTrade[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}
