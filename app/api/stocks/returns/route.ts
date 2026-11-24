import { NextResponse } from "next/server";
import { limitByIp } from "@/lib/api/rate-limit";
import { isBaseVerifiedStockAddress } from "@/lib/stocks/base-verified";
import { returnsFromCandles, type StockReturns } from "@/lib/stocks/performance";

export const dynamic = "force-dynamic";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const MAX_ADDRESSES = 25;
const DAY = 86_400;
const SPAN_DAYS = 95; // a little over the longest period we show (90 days)
// DefiLlama allows at most 500 data points per call (coins x days), so 5 stocks per call.
const PER_CALL = Math.floor(500 / SPAN_DAYS);
const TTL_MS = 60 * 60 * 1000;
const RETRY_MS = 60 * 1000;
// shortcut: per-instance memory cache, fine for hourly numbers; move to KV if cold starts make it slow.
const cache = new Map<string, { at: number; value: StockReturns | null }>();

type LlamaChart = { coins?: Record<string, { prices?: Array<{ timestamp: number; price: number }> }> };

/** One DefiLlama call per group of stocks not cached (no per-token pool lookups, so no burst throttling). */
async function loadGroup(missing: string[]): Promise<void> {
  const now = Date.now();
  let body: LlamaChart | null = null;
  try {
    const start = Math.floor(now / 1000) - SPAN_DAYS * DAY;
    const r = await fetch(`https://coins.llama.fi/chart/${missing.map((a) => `base:${a}`).join(",")}?start=${start}&span=${SPAN_DAYS}&period=1d`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (r.ok) body = (await r.json()) as LlamaChart;
  } catch {
    body = null;
  }
  const byLower = new Map(Object.entries(body?.coins ?? {}).map(([k, v]) => [k.toLowerCase().replace(/^base:/, ""), v]));
  for (const a of missing) {
    const prices = byLower.get(a)?.prices;
    const value = prices?.length ? returnsFromCandles(prices.map((p) => ({ t: p.timestamp, c: p.price }))) : null;
    // A miss is retried after a minute, a hit is kept for an hour.
    cache.set(a, { at: value ? now : now - TTL_MS + RETRY_MS, value });
  }
}

/** 7/30/90-day returns for official tokenized stocks. Only addresses from Base's official list are accepted. */
export async function GET(request: Request) {
  const limited = await limitByIp(request, "stock-returns", 30);
  if (limited) return limited;

  const raw = new URL(request.url).searchParams.get("addresses") ?? "";
  const addresses = [...new Set(raw.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean))];
  if (addresses.length === 0 || addresses.length > MAX_ADDRESSES) {
    return NextResponse.json({ ok: false, error: `Send 1 to ${MAX_ADDRESSES} addresses` }, { status: 400 });
  }
  if (addresses.some((a) => !ADDRESS_RE.test(a) || !isBaseVerifiedStockAddress(a))) {
    return NextResponse.json({ ok: false, error: "Only official tokenized stocks are supported" }, { status: 400 });
  }

  const missing = addresses.filter((a) => {
    const hit = cache.get(a);
    return !hit || Date.now() - hit.at >= TTL_MS;
  });
  const groups: string[][] = [];
  for (let i = 0; i < missing.length; i += PER_CALL) groups.push(missing.slice(i, i + PER_CALL));
  await Promise.all(groups.map(loadGroup));

  const returns: Record<string, StockReturns | null> = {};
  for (const a of addresses) returns[a] = cache.get(a)?.value ?? null;
  return NextResponse.json({ ok: true, returns }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
}
