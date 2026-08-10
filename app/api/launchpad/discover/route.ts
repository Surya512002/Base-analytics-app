import { NextResponse } from "next/server";
import { discoverTrendingBaseTokens } from "@/lib/launchpad/external-discovery";
import { discoverB20Tokens } from "@/lib/launchpad/b20-discovery";
import { readDiscoverCache, writeDiscoverCache } from "@/lib/launchpad/market-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CDN_HEADERS = {
  "Cache-Control":
    "public, s-maxage=90, stale-while-revalidate=180, max-age=30",
};

/**
 * Discover tradeable tokens:
 * 1. B20 factory + Gecko + DexScreener (B20 vanity addresses)
 * 2. Gecko + DexScreener trending Base tokens (non-B20)
 */
export async function GET() {
  try {
    const cached = await readDiscoverCache();
    if (cached) {
      return NextResponse.json(cached, { headers: CDN_HEADERS });
    }

    const [b20, trending] = await Promise.all([
      discoverB20Tokens().catch((e) => {
        console.error("[launchpad/discover] b20", e);
        return { tokens: [], markets: {} };
      }),
      discoverTrendingBaseTokens().catch((e) => {
        console.error("[launchpad/discover] trending", e);
        return { tokens: [], markets: {} };
      }),
    ]);

    const tokens = [...trending.tokens, ...b20.tokens];
    const markets = { ...trending.markets, ...b20.markets };

    const payload = {
      tokens,
      markets,
      recentB20Count: b20.tokens.length,
      trendingCount: trending.tokens.length,
      partial: b20.tokens.length === 0 || trending.tokens.length === 0,
    };

    await writeDiscoverCache(payload);
    return NextResponse.json(payload, { headers: CDN_HEADERS });
  } catch (e) {
    console.error("[launchpad/discover]", e);
    return NextResponse.json(
      {
        tokens: [],
        markets: {},
        recentB20Count: 0,
        trendingCount: 0,
        error: "Discovery failed",
      },
      { status: 503 }
    );
  }
}
