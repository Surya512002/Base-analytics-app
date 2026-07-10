import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { sortByPriceChange } from "@/lib/launchpad/merge-tokens";
import { isTradableListing } from "@/lib/launchpad/tradable";

/**
 * B20 top gainers — positive 24h movers first, then fills with next-best price change.
 */
export function buildB20GainersRail(
  b20Tokens: LaunchedToken[],
  markets: Record<string, TokenMarketSummary>,
  b20Trending: LaunchedToken[],
  limit = 10,
  opts?: { excludeTrending?: boolean }
): LaunchedToken[] {
  const excludeTrending = opts?.excludeTrending !== false;
  const trendingIds = excludeTrending
    ? new Set(b20Trending.map((t) => t.address.toLowerCase()))
    : new Set<string>();

  const pooled = b20Tokens.filter(
    (t) =>
      isTradableListing(t, markets) &&
      (!excludeTrending || !trendingIds.has(t.address.toLowerCase()))
  );

  const positive = sortByPriceChange(
    pooled.filter((t) => (markets[t.address.toLowerCase()]?.priceChange24h ?? 0) > 0),
    markets,
    "gainers"
  );

  if (positive.length >= limit) {
    return positive.slice(0, limit);
  }

  const used = new Set(positive.map((t) => t.address.toLowerCase()));
  const fillers = sortByPriceChange(
    pooled.filter((t) => !used.has(t.address.toLowerCase())),
    markets,
    "gainers"
  );

  return [...positive, ...fillers].slice(0, limit);
}
