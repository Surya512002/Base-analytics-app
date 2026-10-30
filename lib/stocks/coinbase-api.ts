import {
  BASE_STOCKS,
  type BaseStock,
  getBaseStockByAddress,
  getBaseStockBySymbol,
} from "./base-stocks";

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

export type LiquidityHealthTier = "deep" | "moderate" | "low" | "paused";

export interface CoinbaseTokenizedStock {
  symbol: string; // e.g. "NVDAc"
  underlyingTicker: string; // e.g. "NVDA"
  name: string; // e.g. "NVIDIA Corporation"
  address: `0x${string}`;
  nav: number; // Current NAV / share price in USD
  change24h: number; // Percent e.g. +2.45
  volume24hUsd: number;
  mcapUsd: number;
  decimals: number; // 8 for B20 stocks
  iconUrl?: string;
  category: "tech" | "crypto" | "finance" | "aerospace" | "consumer" | "health" | "index" | string;
  feedAddress: `0x${string}` | null;
  custodian: string;
  isRegulated: boolean;
  backingRatio: number; // 1.0 (100% backed)
  description?: string;
  multiplier: number; // Share multiplier, default 1.0
  isPaused: boolean; // Trading pause or weekend/holiday halt
  liquidityHealth: LiquidityHealthTier; // Liquidity health status
  high24h?: number;
  low24h?: number;
}

export interface CoinbaseApiResponse {
  data: Array<{
    id: string;
    symbol: string;
    name: string;
    address: string;
    nav?: number | string;
    price?: number | string;
    percent_change_24h?: number | string;
    volume_24h?: number | string;
    market_cap?: number | string;
    icon_url?: string;
    category?: string;
    feed_address?: string;
    multiplier?: number | string;
    is_paused?: boolean;
    status?: string;
    high_24h?: number | string;
    low_24h?: number | string;
  }>;
  pagination?: {
    page_token?: string | null;
    next_page_token?: string | null;
    next_cursor?: string | null;
    has_more?: boolean;
    total_count?: number;
  };
}

/** In-memory cache for fast responsive terminal loads */
let memoryCache: {
  stocks: CoinbaseTokenizedStock[];
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 60_000; // 60 seconds
const REDIS_CACHE_KEY = "base_stocks_catalog_v2";

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

/** Determine liquidity health indicator based on volume and paused status */
export function computeLiquidityHealth(
  volume24hUsd: number,
  isPaused: boolean
): LiquidityHealthTier {
  if (isPaused) return "paused";
  if (volume24hUsd >= 20_000_000) return "deep";
  if (volume24hUsd >= 5_000_000) return "moderate";
  return "low";
}

/** Baseline live prices and data for top Coinbase tokenized stocks */
const BASELINE_STOCK_METRICS: Record<
  string,
  { nav: number; change24h: number; volume24h: number; mcap: number; desc: string; multiplier?: number; isPaused?: boolean }
> = {
  NVDAc: {
    nav: 138.25,
    change24h: 3.12,
    volume24h: 42_500_000,
    mcap: 3_410_000_000,
    desc: "NVIDIA Corp tokenized equity. Global leader in AI computing hardware and GPUs.",
    multiplier: 1.0,
    isPaused: false,
  },
  AAPLc: {
    nav: 232.5,
    change24h: 0.85,
    volume24h: 31_200_000,
    mcap: 3_550_000_000,
    desc: "Apple Inc tokenized equity. Consumer technology, iPhone, Mac, and services ecosystem.",
    multiplier: 1.0,
    isPaused: false,
  },
  TSLAc: {
    nav: 221.8,
    change24h: -1.45,
    volume24h: 28_400_000,
    mcap: 710_000_000,
    desc: "Tesla Inc tokenized equity. Electric vehicles, energy storage, and autonomous driving.",
    multiplier: 1.0,
    isPaused: false,
  },
  COINc: {
    nav: 215.4,
    change24h: 4.82,
    volume24h: 35_100_000,
    mcap: 53_000_000,
    desc: "Coinbase Global Inc tokenized equity. Leading cryptocurrency exchange and Base creator.",
    multiplier: 1.0,
    isPaused: false,
  },
  GOOGLc: {
    nav: 184.6,
    change24h: 1.15,
    volume24h: 19_800_000,
    mcap: 2_280_000_000,
    desc: "Alphabet Inc tokenized equity. Search engine, Google Cloud, Android, and AI research.",
    multiplier: 1.0,
    isPaused: false,
  },
  MSFTc: {
    nav: 418.9,
    change24h: 0.62,
    volume24h: 22_400_000,
    mcap: 3_120_000_000,
    desc: "Microsoft Corp tokenized equity. Azure cloud infrastructure, Windows, and enterprise AI.",
    multiplier: 1.0,
    isPaused: false,
  },
  AMZNc: {
    nav: 196.2,
    change24h: 1.4,
    volume24h: 18_900_000,
    mcap: 2_050_000_000,
    desc: "Amazon.com Inc tokenized equity. E-commerce giant and AWS cloud platform provider.",
    multiplier: 1.0,
    isPaused: false,
  },
  METAc: {
    nav: 592.1,
    change24h: 2.18,
    volume24h: 16_700_000,
    mcap: 1_500_000_000,
    desc: "Meta Platforms Inc tokenized equity. Social networks (Instagram, WhatsApp) and Llama AI.",
    multiplier: 1.0,
    isPaused: false,
  },
  MSTRc: {
    nav: 194.5,
    change24h: 5.92,
    volume24h: 38_200_000,
    mcap: 38_500_000,
    desc: "MicroStrategy Inc tokenized equity. Enterprise analytics and premier corporate Bitcoin treasury.",
    multiplier: 1.0,
    isPaused: false,
  },
  CRCLc: {
    nav: 104.2,
    change24h: 0.25,
    volume24h: 12_400_000,
    mcap: 18_200_000,
    desc: "Circle Internet tokenized equity. Issuer of USDC and developer of web3 financial infrastructure.",
    multiplier: 1.0,
    isPaused: false,
  },
  INTCc: {
    nav: 23.4,
    change24h: -0.65,
    volume24h: 9_200_000,
    mcap: 100_000_000,
    desc: "Intel Corp tokenized equity. Semiconductor design and foundry manufacturing.",
    multiplier: 1.0,
    isPaused: false,
  },
  SPCXc: {
    nav: 145.0,
    change24h: 1.8,
    volume24h: 14_500_000,
    mcap: 210_000_000,
    desc: "SpaceX tokenized private equity proxy. Commercial aerospace, Starlink, and reusable rocketry.",
    multiplier: 1.0,
    isPaused: false,
  },
  PLTRc: {
    nav: 44.8,
    change24h: 4.15,
    volume24h: 26_100_000,
    mcap: 98_000_000,
    desc: "Palantir Technologies tokenized equity. Defense, intelligence, and commercial big-data AI platforms.",
    multiplier: 1.0,
    isPaused: false,
  },
  AMDc: {
    nav: 156.3,
    change24h: 1.72,
    volume24h: 17_500_000,
    mcap: 252_000_000,
    desc: "Advanced Micro Devices tokenized equity. High-performance processors, Instinct AI GPUs, and EPYC.",
    multiplier: 1.0,
    isPaused: false,
  },
  ARMc: {
    nav: 142.1,
    change24h: 2.3,
    volume24h: 11_800_000,
    mcap: 148_000_000,
    desc: "Arm Holdings tokenized equity. Semiconductor architecture IP powering 99% of global smartphones.",
    multiplier: 1.0,
    isPaused: false,
  },
};

/** Get baseline NAV price for a tokenized stock by symbol or address */
export function getStockBaselineNav(symbolOrAddress?: string | null): number | null {
  if (!symbolOrAddress) return null;
  const s = symbolOrAddress.trim().toLowerCase();
  for (const [sym, metric] of Object.entries(BASELINE_STOCK_METRICS)) {
    if (sym.toLowerCase() === s) return metric.nav;
  }
  const stock = getBaseStockByAddress(s as `0x${string}`) ?? getBaseStockBySymbol(symbolOrAddress);
  if (stock) {
    const metric = BASELINE_STOCK_METRICS[stock.symbol];
    if (metric) return metric.nav;
  }
  return null;
}

/** Convert BaseStock to full CoinbaseTokenizedStock */
export function buildStockFromBaseStock(stock: BaseStock): CoinbaseTokenizedStock {
  const metrics = BASELINE_STOCK_METRICS[stock.symbol] ?? {
    nav: 100.0,
    change24h: 0.0,
    volume24h: 5_000_000,
    mcap: 50_000_000,
    desc: `${stock.name} tokenized US equity on Base network. Backed 1:1 by custodian shares.`,
    multiplier: 1.0,
    isPaused: false,
  };

  const isPaused = metrics.isPaused ?? false;
  const multiplier = metrics.multiplier ?? 1.0;
  const liquidityHealth = computeLiquidityHealth(metrics.volume24h, isPaused);

  return {
    symbol: stock.symbol,
    underlyingTicker: stock.symbol.replace(/c$/, ""),
    name: stock.name,
    address: stock.address,
    nav: metrics.nav,
    change24h: metrics.change24h,
    volume24hUsd: metrics.volume24h,
    mcapUsd: metrics.mcap,
    decimals: stock.decimals,
    iconUrl: stock.logo || `/tokens/${stock.address.toLowerCase()}.png`,
    category: stock.category ?? "tech",
    feedAddress: stock.feed,
    custodian: "Coinbase Custody / Alpaca (Reg S 1:1 Backed)",
    isRegulated: true,
    backingRatio: 1.0,
    description: metrics.desc,
    multiplier,
    isPaused,
    liquidityHealth,
    high24h: Math.round(metrics.nav * 1.03 * 100) / 100,
    low24h: Math.round(metrics.nav * 0.97 * 100) / 100,
  };
}

/**
 * Paginated helper for Coinbase tokenized stocks that handles page_token offsets and limit.
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
  const all = await fetchAllCoinbaseTokenizedStocks({ pageToken: options?.page_token, limit: options?.limit });
  const limit = options?.limit ?? 4;
  let startIndex = 0;
  if (options?.page_token) {
    const parsed = parseInt(options.page_token, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      startIndex = parsed;
    }
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
 * Fetch all Coinbase tokenized stocks handling full pagination with page_token,
 * upstream API integration, Redis caching, and resilient fallback to Base B20 registry.
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

  // Check Redis cache first (server-only)
  if (!options?.forceRefresh) {
    try {
      const redisCached = await getRedisCache<CoinbaseTokenizedStock[]>(REDIS_CACHE_KEY);
      if (redisCached && Array.isArray(redisCached) && redisCached.length > 0) {
        memoryCache = {
          stocks: redisCached,
          timestamp: now,
        };
        return redisCached;
      }
    } catch {
      // Redis unavailable or failed, continue to network fetch
    }
  }

  const allStocks: CoinbaseTokenizedStock[] = [];
  const pageSize = options?.limit ?? 50;

  try {
    let currentPageToken: string | null = options?.pageToken ?? null;
    let pagesFetched = 0;
    const maxPages = 5;

    do {
      pagesFetched++;
      const url = new URL("https://api.coinbase.com/v1/tokenized-stocks");
      url.searchParams.set("limit", String(pageSize));
      if (currentPageToken) {
        // Support both page_token (canonical) and cursor (legacy)
        url.searchParams.set("page_token", currentPageToken);
        url.searchParams.set("cursor", currentPageToken);
      }

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(4000), // 4s timeout
      });

      if (!res.ok) break;

      const data = (await res.json()) as CoinbaseApiResponse;
      if (!data?.data || !Array.isArray(data.data)) break;

      for (const item of data.data) {
        const addr = (item.address?.toLowerCase() ?? "") as `0x${string}`;
        const existingBase = getBaseStockByAddress(addr) ?? getBaseStockBySymbol(item.symbol);

        // Strictly retain only the 8 verified canonical stocks supported by the app
        if (!existingBase) continue;

        const nav = typeof item.nav === "number" ? item.nav : parseFloat(String(item.nav || item.price || 0)) || 100;
        const change = typeof item.percent_change_24h === "number" ? item.percent_change_24h : parseFloat(String(item.percent_change_24h || 0));
        const volume = typeof item.volume_24h === "number" ? item.volume_24h : parseFloat(String(item.volume_24h || 0)) || 10_000_000;
        const mcap = typeof item.market_cap === "number" ? item.market_cap : parseFloat(String(item.market_cap || 0)) || 100_000_000;
        const multiplier = typeof item.multiplier === "number" ? item.multiplier : parseFloat(String(item.multiplier || 1.0)) || 1.0;
        const isPaused = Boolean(item.is_paused || item.status === "paused" || item.status === "halted");
        const liquidityHealth = computeLiquidityHealth(volume, isPaused);

        // Prevent duplicate entries
        if (allStocks.some((s) => s.symbol.toLowerCase() === existingBase.symbol.toLowerCase())) continue;

        allStocks.push({
          symbol: existingBase.symbol,
          underlyingTicker: existingBase.symbol.replace(/c$/, ""),
          name: existingBase.name || item.name || item.symbol,
          address: existingBase.address,
          nav,
          change24h: change,
          volume24hUsd: volume,
          mcapUsd: mcap,
          decimals: 8,
          iconUrl: existingBase.logo || item.icon_url || `/tokens/${existingBase.address.toLowerCase()}.png`,
          category: (existingBase.category as CoinbaseTokenizedStock["category"]) ?? (item.category as CoinbaseTokenizedStock["category"]) ?? "tech",
          feedAddress: existingBase.feed ?? null,
          custodian: "Coinbase Custody / Alpaca (Reg S 1:1 Backed)",
          isRegulated: true,
          backingRatio: 1.0,
          multiplier,
          isPaused,
          liquidityHealth,
          high24h: typeof item.high_24h === "number" ? item.high_24h : nav * 1.02,
          low24h: typeof item.low_24h === "number" ? item.low_24h : nav * 0.98,
        });
      }

      // If we already gathered all active base stocks, exit pagination early
      if (allStocks.length >= BASE_STOCKS.length) break;

      // Handle pagination via page_token or cursor
      currentPageToken =
        data.pagination?.next_page_token ||
        (data.pagination?.has_more && data.pagination.next_cursor ? data.pagination.next_cursor : null) ||
        null;
    } while (currentPageToken && pagesFetched < maxPages);
  } catch {
    // Graceful fallback to verified Base B20 registry
  }

  // Ensure all 8 canonical Base stocks are present
  const stockMap = new Map(allStocks.map((s) => [s.symbol.toLowerCase(), s]));
  const canonical8Stocks: CoinbaseTokenizedStock[] = [];
  for (const bStock of BASE_STOCKS) {
    const existing = stockMap.get(bStock.symbol.toLowerCase());
    if (existing) {
      canonical8Stocks.push(existing);
    } else {
      canonical8Stocks.push(buildStockFromBaseStock(bStock));
    }
  }

  // Populate memory cache
  memoryCache = {
    stocks: canonical8Stocks,
    timestamp: now,
  };

  // Populate Redis cache async (60s TTL)
  void setRedisCache(REDIS_CACHE_KEY, canonical8Stocks, 60).catch(() => {});

  return canonical8Stocks;
}
