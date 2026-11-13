import { NextResponse } from "next/server";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import {
  fetchDexScreenerBatch,
  pickBestPair,
  summarizePair,
} from "@/lib/launchpad/dexscreener";

export const dynamic = "force-dynamic";

/** UI timeframe → GeckoTerminal OHLCV (unit + aggregate) */
const TIMEFRAMES: Record<string, { unit: "minute" | "hour" | "day"; aggregate: number }> = {
  "1m": { unit: "minute", aggregate: 1 },
  "5m": { unit: "minute", aggregate: 5 },
  "15m": { unit: "minute", aggregate: 15 },
  "1h": { unit: "hour", aggregate: 1 },
  "4h": { unit: "hour", aggregate: 4 },
  "1d": { unit: "day", aggregate: 1 },
};

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: Request) {
  const rl = await checkRateLimitAsync(`trade-candles:${getClientIp(request)}`, 90, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { searchParams } = new URL(request.url);
  const address = (searchParams.get("address") ?? "").trim();
  const requested = searchParams.get("tf") ?? "15m";
  const tf = TIMEFRAMES[requested] ? requested : "15m";
  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json({ ok: false, error: "Invalid token address", candles: [] }, { status: 400 });
  }

  try {
    const batch = await fetchDexScreenerBatch([address]);
    const pair = pickBestPair(batch.get(address.toLowerCase()) ?? []);
    const summary = summarizePair(address, pair);
    const pool = pair?.pairAddress;
    const stats = {
      change: { m5: pair?.priceChange?.m5 ?? null, h1: pair?.priceChange?.h1 ?? null, h6: pair?.priceChange?.h6 ?? null, h24: pair?.priceChange?.h24 ?? null },
      buys24: pair?.txns?.h24?.buys ?? null,
      sells24: pair?.txns?.h24?.sells ?? null,
      dex: pair?.dexId ?? null,
      pairUrl: pair?.url ?? null,
    };
    if (!pool || !ADDRESS_RE.test(pool)) {
      return NextResponse.json({ ok: true, candles: [], summary, stats, pool: null, tf });
    }

    const { unit, aggregate } = TIMEFRAMES[tf];
    const url =
      `https://api.geckoterminal.com/api/v2/networks/base/pools/${pool}/ohlcv/${unit}` +
      `?aggregate=${aggregate}&limit=300&currency=usd&token=${address.toLowerCase()}`;
    const r = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!r.ok) {
      return NextResponse.json({ ok: true, candles: [], summary, stats, pool, tf, note: "Chart feed busy — try again" });
    }
    const body = (await r.json()) as {
      data?: { attributes?: { ohlcv_list?: number[][] } };
    };
    const candles = (body.data?.attributes?.ohlcv_list ?? [])
      .filter((row) => row.length >= 6 && row.every((n) => Number.isFinite(n)))
      .map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }))
      .sort((a, b) => a.t - b.t);

    return NextResponse.json(
      { ok: true, candles, summary, stats, pool, tf },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } }
    );
  } catch (e) {
    console.error("[/api/trade/candles]", e);
    return NextResponse.json({ ok: false, error: "Chart data unavailable", candles: [] }, { status: 502 });
  }
}
