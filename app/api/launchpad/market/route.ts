import { NextResponse } from "next/server";
import { listLaunchedTokens } from "@/lib/launchpad/token-store";
import {
  fetchMarketSummaries,
  type TokenMarketSummary,
} from "@/lib/launchpad/dexscreener";
import { readMarketCache, writeMarketCache } from "@/lib/launchpad/market-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CDN_HEADERS = {
  "Cache-Control":
    "public, s-maxage=90, stale-while-revalidate=180, max-age=30",
};

export async function GET() {
  try {
    const cached = await readMarketCache();
    if (cached) {
      return NextResponse.json(cached, { headers: CDN_HEADERS });
    }

    const tokens = await listLaunchedTokens();
    const addresses = tokens.map((t) => t.address);
    const markets = await fetchMarketSummaries(addresses);

    let totalVolume24h = 0;
    let totalLiquidity = 0;
    let pooledCount = 0;

    for (const m of Object.values(markets)) {
      if (m.volume24h) totalVolume24h += m.volume24h;
      if (m.liquidityUsd) totalLiquidity += m.liquidityUsd;
      if (m.hasPool) pooledCount += 1;
    }

    const payload = {
      markets,
      stats: {
        tokenCount: tokens.length,
        pooledCount,
        totalVolume24h,
        totalLiquidity,
      },
    };

    await writeMarketCache(payload);
    return NextResponse.json(payload, { headers: CDN_HEADERS });
  } catch (e) {
    console.error("[launchpad/market]", e);
    return NextResponse.json(
      {
        markets: {},
        stats: { tokenCount: 0, pooledCount: 0, totalVolume24h: 0, totalLiquidity: 0 },
      },
      { status: 500 }
    );
  }
}

export type { TokenMarketSummary };
