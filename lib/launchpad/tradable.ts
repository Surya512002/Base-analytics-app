import { isAppLaunched } from "@/lib/launchpad/token-meta";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";

/** Minimum pool liquidity (USD) to list a token in explore rails / swap catalog. */
export const MIN_TRADABLE_LIQUIDITY_USD = 1_000;

export function marketFor(
  token: LaunchedToken,
  markets: Record<string, TokenMarketSummary>
): TokenMarketSummary | undefined {
  return markets[token.address.toLowerCase()];
}

/** Token has a live WETH pool on Base with enough liquidity to swap in-app. */
export function isTradableListing(
  token: LaunchedToken,
  markets: Record<string, TokenMarketSummary>
): boolean {
  const m = marketFor(token, markets);
  if (!m?.hasPool) return false;
  if ((m.liquidityUsd ?? 0) < MIN_TRADABLE_LIQUIDITY_USD) return false;
  return true;
}

/** Explore rails / trending — swappable only. Creators see unseeded tokens under Mine. */
export function filterTradableExploreTokens(
  tokens: LaunchedToken[],
  markets: Record<string, TokenMarketSummary>
): LaunchedToken[] {
  return tokens.filter((t) => isTradableListing(t, markets));
}

export function filterCatalogTokens(
  tokens: LaunchedToken[],
  markets: Record<string, TokenMarketSummary>,
  opts?: { includeMine?: boolean; wallet?: string }
): LaunchedToken[] {
  const w = opts?.wallet?.toLowerCase();
  return tokens.filter((t) => {
    if (isTradableListing(t, markets)) return true;
    if (
      opts?.includeMine &&
      w &&
      isAppLaunched(t) &&
      t.creator.toLowerCase() === w
    ) {
      return true;
    }
    return false;
  });
}
