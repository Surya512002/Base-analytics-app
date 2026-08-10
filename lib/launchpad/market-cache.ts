import { cacheGet, cacheSet } from "@/lib/redis-cache";

const MARKET_CACHE_KEY = "launchpad:market:v2";
const DISCOVER_CACHE_KEY = "launchpad:discover:v2";
/** Longer shared TTL — fewer DexScreener + function burns for Explore. */
const TTL_SECONDS = 180;

type MarketCachePayload = {
  markets: Record<string, unknown>;
  stats: {
    tokenCount: number;
    pooledCount: number;
    totalVolume24h: number;
    totalLiquidity: number;
  };
};

type DiscoverCachePayload = {
  tokens: unknown[];
  markets: Record<string, unknown>;
  recentB20Count: number;
  trendingCount: number;
};

let memoryMarket: { payload: MarketCachePayload; expires: number } | null = null;
let memoryDiscover: { payload: DiscoverCachePayload; expires: number } | null = null;

export async function readMarketCache(): Promise<MarketCachePayload | null> {
  const redisHit = await cacheGet<MarketCachePayload>(MARKET_CACHE_KEY);
  if (redisHit) return redisHit;
  if (memoryMarket && Date.now() < memoryMarket.expires) {
    return memoryMarket.payload;
  }
  return null;
}

export async function writeMarketCache(payload: MarketCachePayload): Promise<void> {
  memoryMarket = { payload, expires: Date.now() + TTL_SECONDS * 1000 };
  await cacheSet(MARKET_CACHE_KEY, payload, TTL_SECONDS);
}

export async function readDiscoverCache(): Promise<DiscoverCachePayload | null> {
  const redisHit = await cacheGet<DiscoverCachePayload>(DISCOVER_CACHE_KEY);
  if (redisHit) return redisHit;
  if (memoryDiscover && Date.now() < memoryDiscover.expires) {
    return memoryDiscover.payload;
  }
  return null;
}

export async function writeDiscoverCache(payload: DiscoverCachePayload): Promise<void> {
  memoryDiscover = { payload, expires: Date.now() + TTL_SECONDS * 1000 };
  await cacheSet(DISCOVER_CACHE_KEY, payload, TTL_SECONDS);
}
