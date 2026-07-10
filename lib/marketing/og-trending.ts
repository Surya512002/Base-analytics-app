import { fetchMarketSummaries } from "@/lib/launchpad/dexscreener";
import { listLaunchedTokens } from "@/lib/launchpad/token-store";
import { isB20ExploreToken } from "@/lib/launchpad/token-meta";
import { isTradableListing } from "@/lib/launchpad/tradable";

export type OgTrendingRow = {
  sym: string;
  chg: string;
  vol: string;
};

function formatVol(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd.toFixed(0)}`;
}

const FALLBACK: OgTrendingRow[] = [
  { sym: "B20", chg: "+0.0%", vol: "—" },
  { sym: "BASE", chg: "+0.0%", vol: "—" },
  { sym: "SWAP", chg: "+0.0%", vol: "—" },
];

/** Live top B20 tokens by 24h volume for OG / social thumbnails. */
export async function fetchOgTrendingB20(limit = 3): Promise<OgTrendingRow[]> {
  try {
    const tokens = await listLaunchedTokens();
    const b20 = tokens.filter((t) => isB20ExploreToken(t));
    if (!b20.length) return FALLBACK;

    const markets = await fetchMarketSummaries(b20.map((t) => t.address));
    const ranked = b20
      .filter((t) => isTradableListing(t, markets))
      .sort((a, b) => {
        const va = markets[a.address.toLowerCase()]?.volume24h ?? 0;
        const vb = markets[b.address.toLowerCase()]?.volume24h ?? 0;
        return vb - va;
      })
      .slice(0, limit);

    if (!ranked.length) return FALLBACK;

    return ranked.map((t) => {
      const m = markets[t.address.toLowerCase()];
      const chg = m?.priceChange24h ?? 0;
      const vol = m?.volume24h ?? 0;
      return {
        sym: t.symbol.toUpperCase().slice(0, 8),
        chg: `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%`,
        vol: vol > 0 ? formatVol(vol) : "—",
      };
    });
  } catch {
    return FALLBACK;
  }
}
