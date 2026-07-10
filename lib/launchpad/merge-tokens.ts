import type { LaunchedToken, TokenSource } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { isAppLaunched, tokenSource } from "@/lib/launchpad/token-meta";

const SOURCE_RANK: Record<TokenSource, number> = {
  launched: 3,
  b20: 2,
  external: 1,
};

function withSource(token: LaunchedToken, fallback: TokenSource): LaunchedToken {
  return { ...token, source: token.source ?? fallback };
}

/**
 * Merge app registry + recent B20 factory creates + DexScreener externals.
 * Priority: launched > b20 > external (higher wins on address collision).
 */
export function mergeExploreTokens(
  launched: LaunchedToken[],
  extras: LaunchedToken[] = []
): LaunchedToken[] {
  const byAddr = new Map<string, LaunchedToken>();

  const upsert = (token: LaunchedToken, fallback: TokenSource) => {
    const next = withSource(token, fallback);
    const key = next.address.toLowerCase();
    const prev = byAddr.get(key);
    if (!prev) {
      byAddr.set(key, next);
      return;
    }
    const prevRank = SOURCE_RANK[tokenSource(prev)] ?? 0;
    const nextRank = SOURCE_RANK[tokenSource(next)] ?? 0;
    if (nextRank >= prevRank) {
      byAddr.set(key, {
        ...prev,
        ...next,
        imageUrl: next.imageUrl || prev.imageUrl,
        description: next.description || prev.description,
        website: next.website || prev.website,
        twitter: next.twitter || prev.twitter,
        telegram: next.telegram || prev.telegram,
        createdAt: Math.max(next.createdAt || 0, prev.createdAt || 0),
        source: nextRank >= prevRank ? next.source : prev.source,
      });
    }
  };

  for (const t of extras) {
    upsert(t, t.source ?? "external");
  }
  for (const t of launched) {
    upsert(t, "launched");
  }

  return [...byAddr.values()].sort((a, b) => {
    const ra = SOURCE_RANK[tokenSource(a)] ?? 0;
    const rb = SOURCE_RANK[tokenSource(b)] ?? 0;
    if (ra !== rb) return rb - ra;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

export function sortByMarketVolume(
  tokens: LaunchedToken[],
  markets: Record<string, { volume24h?: number | null }>
): LaunchedToken[] {
  return [...tokens].sort((a, b) => {
    const va = markets[a.address.toLowerCase()]?.volume24h ?? 0;
    const vb = markets[b.address.toLowerCase()]?.volume24h ?? 0;
    return vb - va;
  });
}

export function sortByPriceChange(
  tokens: LaunchedToken[],
  markets: Record<string, TokenMarketSummary>,
  direction: "gainers" | "losers" = "gainers"
): LaunchedToken[] {
  return [...tokens].sort((a, b) => {
    const ca = markets[a.address.toLowerCase()]?.priceChange24h ?? 0;
    const cb = markets[b.address.toLowerCase()]?.priceChange24h ?? 0;
    return direction === "gainers" ? cb - ca : ca - cb;
  });
}

export function sortByMarketTxns(
  tokens: LaunchedToken[],
  markets: Record<string, { txns24h?: number | null }>
): LaunchedToken[] {
  return [...tokens].sort((a, b) => {
    const ta = markets[a.address.toLowerCase()]?.txns24h ?? 0;
    const tb = markets[b.address.toLowerCase()]?.txns24h ?? 0;
    return tb - ta;
  });
}

export { isAppLaunched };
