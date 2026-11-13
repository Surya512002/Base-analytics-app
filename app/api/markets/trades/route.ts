import { NextResponse } from "next/server";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import {
  fetchPoolTrades,
  isPoolId,
  isTokenAddress,
  mergeTrades,
  topPoolForToken,
} from "@/lib/markets/live-trades";

export const dynamic = "force-dynamic";

const MAX_POOLS = 5;
const MAX_TRADES = 40;

/**
 * GET /api/markets/trades?pools=0x..,0x..   recent trades across up to 5 pools (Explore feed)
 * GET /api/markets/trades?token=0x..        recent trades in the token's most active pool (Swap)
 */
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimitAsync(`market-trades:${ip}`, 30, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim().toLowerCase() ?? "";
  const poolsParam = searchParams.get("pools")?.trim().toLowerCase() ?? "";

  let pools: string[] = [];
  if (token) {
    if (!isTokenAddress(token)) {
      return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
    }
    const pool = await topPoolForToken(token);
    pools = pool ? [pool] : [];
  } else {
    pools = [...new Set(poolsParam.split(",").map((p) => p.trim()).filter(Boolean))];
    if (!pools.length || pools.length > MAX_POOLS || !pools.every(isPoolId)) {
      return NextResponse.json({ error: `Pass 1-${MAX_POOLS} valid pool ids` }, { status: 400 });
    }
  }

  const lists = await Promise.all(pools.map((p) => fetchPoolTrades(p)));
  return NextResponse.json(
    { trades: mergeTrades(lists, MAX_TRADES), pools, updatedAt: Date.now() },
    { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } }
  );
}
