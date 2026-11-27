import { discoverTrendingBaseTokens } from "@/lib/launchpad/external-discovery";
import { discoverB20Tokens } from "@/lib/launchpad/b20-discovery";
import { readDiscoverCache, writeDiscoverCache } from "@/lib/launchpad/market-cache";

/**
 * Tradeable tokens found on Base (B20 factory + trending), cached for a short while.
 * Shared by the discover endpoint and the market board.
 */
export async function getDiscovery() {
  const cached = await readDiscoverCache();
  if (cached) return cached;
  // One lookup at a time: visitors arriving together share it.
  inflight ??= lookUp().finally(() => {
    inflight = null;
  });
  return inflight;
}

let inflight: ReturnType<typeof lookUp> | null = null;

async function lookUp() {
  const [b20, trending] = await Promise.all([
    discoverB20Tokens().catch((e) => {
      console.error("[discovery] b20", e);
      return { tokens: [], markets: {} };
    }),
    discoverTrendingBaseTokens().catch((e) => {
      console.error("[discovery] trending", e);
      return { tokens: [], markets: {} };
    }),
  ]);

  const payload = {
    tokens: [...trending.tokens, ...b20.tokens],
    markets: { ...trending.markets, ...b20.markets },
    recentB20Count: b20.tokens.length,
    trendingCount: trending.tokens.length,
    partial: b20.tokens.length === 0 || trending.tokens.length === 0,
  };
  await writeDiscoverCache(payload);
  return payload;
}
