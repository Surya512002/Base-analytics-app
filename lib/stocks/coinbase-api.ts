/**
 * Live market data for the tokenized stocks the app offers.
 *
 * Which stocks: the live registry (BASE_STOCKS — stocks with tokens in circulation; see
 * live-stocks.generated.ts). Market data: DexScreener, from each stock's own pools on Base
 * (deepest pool sets the price; volume and liquidity are summed over the stock's pools).
 *
 * Nothing is estimated or invented. A stock without a pool has `nav: null` and the other market
 * fields null, and the UI shows "—". Coinbase's API lists the tokens and their supply but no
 * prices, so it is not used for prices here.
 */
import { BASE_STOCKS, type BaseStock, getBaseStockBySymbol, getTokenizedStockByAddress } from "./base-stocks";

async function getRedisCache<T>(key: string): Promise<T | null> {
  if (typeof window !== "undefined") return null;
  try {
    const { cacheGet } = await import("@/lib/redis-cache");
    return await cacheGet<T>(key);
  } catch {
    return null;
  }
}

async function setRedisCache(key: string, data: unknown, ttlSec: number): Promise<void> {
  if (typeof window !== "undefined") return;
  try {
    const { cacheSet } = await import("@/lib/redis-cache");
    await cacheSet(key, data, ttlSec);
  } catch {
    /* ignore */
  }
}

/** Pool depth on Base DEXs: "none" when the stock has no pool, "unknown" before data loads. */
export type LiquidityHealthTier = "deep" | "moderate" | "low" | "none" | "unknown";

export interface CoinbaseTokenizedStock {
  symbol: string; // e.g. "NVDAc"
  underlyingTicker: string; // e.g. "NVDA"
  name: string; // e.g. "NVIDIA Corporation"
  address: `0x${string}`;
  /** Last DEX price in USD (deepest Base pool), or null when the stock has no pool. */
  nav: number | null;
  /** 24h price change in percent, from the same pool. */
  change24h: number | null;
  /** 24h volume across the stock's Base pools. */
  volume24hUsd: number | null;
  /** Market cap reported for the token (supply × price), when known. */
  mcapUsd: number | null;
  /** Liquidity across the stock's Base pools. */
  liquidityUsd: number | null;
  decimals: number; // 8 for B20 stocks
  iconUrl?: string;
  category: string;
  feedAddress: `0x${string}` | null;
  issuer: string;
  description?: string;
  liquidityHealth: LiquidityHealthTier;
  /** DEX that set the price, e.g. "aerodrome". */
  dexId: string | null;
  pairAddress: string | null;
  /** When this market data was read (ISO). */
  asOf: string;
}

/** In-memory cache for fast loads */
let memoryCache: { stocks: CoinbaseTokenizedStock[]; timestamp: number } | null = null;

const CACHE_TTL_MS = 60_000; // 60 seconds
const REDIS_CACHE_KEY = "base_stocks_catalog_v3";

/** Stock icons using self-hosted canonical token logos */
export function getStockIconUrl(symbol: string, address?: string): string {
  if (address) {
    return `/tokens/${address.toLowerCase()}.png`;
  }
  const stock = getBaseStockBySymbol(symbol);
  if (stock?.logo) return stock.logo;
  if (stock?.address) return `/tokens/${stock.address.toLowerCase()}.png`;
  return `/tokens/${symbol.toLowerCase()}.png`;
}

/** Pool-depth tier from real pool liquidity. */
export function computeLiquidityHealth(liquidityUsd: number | null | undefined): LiquidityHealthTier {
  if (liquidityUsd == null) return "none";
  if (liquidityUsd >= 1_000_000) return "deep";
  if (liquidityUsd >= 100_000) return "moderate";
  if (liquidityUsd > 0) return "low";
  return "none";
}

type StockMarket = Pick<
  CoinbaseTokenizedStock,
  "nav" | "change24h" | "volume24hUsd" | "mcapUsd" | "liquidityUsd" | "dexId" | "pairAddress"
>;

const NO_MARKET: StockMarket = {
  nav: null,
  change24h: null,
  volume24hUsd: null,
  mcapUsd: null,
  liquidityUsd: null,
  dexId: null,
  pairAddress: null,
};

/** A stock with registry details and no market data yet (UI shows "—"). */
export function buildStockFromBaseStock(stock: BaseStock, market: StockMarket = NO_MARKET): CoinbaseTokenizedStock {
  const entry = getTokenizedStockByAddress(stock.address);
  return {
    symbol: stock.symbol,
    underlyingTicker: stock.underlyingTicker || stock.symbol.replace(/c$/, ""),
    name: stock.name,
    address: stock.address,
    ...market,
    decimals: stock.decimals,
    iconUrl: stock.logo || `/tokens/${stock.address.toLowerCase()}.png`,
    category: stock.category ?? "other",
    feedAddress: stock.feed,
    issuer: stock.issuer ?? "Coinbase",
    description: entry?.description,
    liquidityHealth: market === NO_MARKET ? "unknown" : computeLiquidityHealth(market.liquidityUsd),
    asOf: new Date().toISOString(),
  };
}

/** Real market data for each stock from its own Base pools (only pools where the stock is the base token). */
async function fetchStockMarkets(addresses: string[]): Promise<Map<string, StockMarket>> {
  const out = new Map<string, StockMarket>();
  if (!addresses.length) return out;
  const { fetchDexScreenerBatch } = await import("@/lib/launchpad/dexscreener");
  const pairsByToken = await fetchDexScreenerBatch(addresses);
  for (const addr of addresses) {
    const lower = addr.toLowerCase();
    const pairs = (pairsByToken.get(lower) ?? []).filter(
      (p) => (p.chainId ?? "").toLowerCase() === "base" && (p.baseToken?.address ?? "").toLowerCase() === lower
    );
    if (!pairs.length) {
      out.set(lower, { ...NO_MARKET, liquidityUsd: 0 });
      continue;
    }
    const best = [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]!;
    const price = best.priceUsd ? parseFloat(best.priceUsd) : NaN;
    out.set(lower, {
      nav: Number.isFinite(price) && price > 0 ? price : null,
      change24h: typeof best.priceChange?.h24 === "number" ? best.priceChange.h24 : null,
      volume24hUsd: pairs.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0),
      mcapUsd: best.marketCap ?? best.fdv ?? null,
      liquidityUsd: pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0),
      dexId: best.dexId ?? null,
      pairAddress: best.pairAddress ?? null,
    });
  }
  return out;
}

/**
 * Paginated helper (page_token is a numeric offset).
 */
export async function fetchCoinbaseTokenizedStocks(options?: {
  page_token?: string | null;
  limit?: number;
}): Promise<{
  stocks: CoinbaseTokenizedStock[];
  has_more: boolean;
  next_page_token?: string | null;
  total_count: number;
}> {
  const all = await fetchAllCoinbaseTokenizedStocks();
  const limit = options?.limit ?? 4;
  let startIndex = 0;
  if (options?.page_token) {
    const parsed = parseInt(options.page_token, 10);
    if (!isNaN(parsed) && parsed >= 0) startIndex = parsed;
  }
  const slice = all.slice(startIndex, startIndex + limit);
  const nextIdx = startIndex + limit;
  const hasMore = nextIdx < all.length;
  return {
    stocks: slice,
    has_more: hasMore,
    next_page_token: hasMore ? String(nextIdx) : null,
    total_count: all.length,
  };
}

/**
 * Every live stock the app offers, with real DEX market data. Cached 60s (memory + Redis).
 * When DexScreener can't be reached, stocks come back with null market data, never estimates.
 */
export async function fetchAllCoinbaseTokenizedStocks(options?: {
  forceRefresh?: boolean;
  limit?: number;
  pageToken?: string | null;
}): Promise<CoinbaseTokenizedStock[]> {
  const now = Date.now();
  if (!options?.forceRefresh && memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.stocks;
  }

  if (!options?.forceRefresh) {
    const redisCached = await getRedisCache<CoinbaseTokenizedStock[]>(REDIS_CACHE_KEY);
    if (redisCached && Array.isArray(redisCached) && redisCached.length > 0) {
      memoryCache = { stocks: redisCached, timestamp: now };
      return redisCached;
    }
  }

  let markets = new Map<string, StockMarket>();
  try {
    markets = await fetchStockMarkets(BASE_STOCKS.map((s) => s.address));
  } catch {
    markets = new Map();
  }

  const stocks = BASE_STOCKS.map((s) => {
    const m = markets.get(s.address.toLowerCase());
    return m ? buildStockFromBaseStock(s, m) : buildStockFromBaseStock(s);
  });

  // Only cache a real read (at least one stock priced), so an outage isn't pinned for a minute.
  if (stocks.some((s) => s.nav != null)) {
    memoryCache = { stocks, timestamp: now };
    void setRedisCache(REDIS_CACHE_KEY, stocks, 60).catch(() => {});
  }
  return stocks;
}
