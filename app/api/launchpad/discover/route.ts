import { NextResponse } from "next/server";
import { limitByIp } from "@/lib/api/rate-limit";
import { getDiscovery } from "@/lib/launchpad/discovery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Discover tradeable tokens:
 * 1. B20 factory + Gecko + DexScreener (B20 vanity addresses)
 * 2. Gecko + DexScreener trending Base tokens (non-B20)
 */
export async function GET(req: Request) {
  const limited = await limitByIp(req, "launchpad-discover", 30);
  if (limited) return limited;
  try {
    return NextResponse.json(await getDiscovery());
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
