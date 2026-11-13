import { NextResponse } from "next/server";
import { listLaunchedTokens } from "@/lib/launchpad/token-store";
import { fetchMarketSummaries } from "@/lib/launchpad/dexscreener";
import { buildLaunchBoard } from "@/lib/launchpad/launch-board";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

/** Launch board: totals for app launches plus "Trending today" and "Just launched" lists. */
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimitAsync(`launch-board:${ip}`, 30, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  try {
    const tokens = (await listLaunchedTokens()).filter((t) => t.source !== "external");
    const markets = tokens.length ? await fetchMarketSummaries(tokens.map((t) => t.address)) : {};
    const board = buildLaunchBoard(tokens, markets, Date.now());
    return NextResponse.json(
      { ...board, updatedAt: Date.now() },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (e) {
    console.error("[launchpad/board]", e);
    return NextResponse.json({ error: "Launch board unavailable" }, { status: 502 });
  }
}
