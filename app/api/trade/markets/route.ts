import { NextResponse } from "next/server";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import { fetchAllCoinbaseTokenizedStocks } from "@/lib/stocks/coinbase-api";
import type { DexScreenerPair } from "@/lib/launchpad/dexscreener";

export const dynamic = "force-dynamic";

export type TradeMarket = {
  kind: "stock" | "coin";
  address: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  change24h: number | null;
  volume24hUsd: number | null;
  iconUrl?: string;
  decimals?: number;
};

/** Majors shown before the user searches */
const COIN_SEEDS = [
  "0x4200000000000000000000000000000000000006", // WETH
  "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", // cbBTC
  "0x940181a94A35A4569E4529A3CDfB74e38FD98631", // AERO
  "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", // cbETH
  "0x532f27101965dd16442E59d40670FaF5eBB142E4", // BRETT
];

function num(v: unknown): number | null {
  const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function pairToCoin(p: DexScreenerPair): TradeMarket | null {
  const tok = p.baseToken;
  if (!tok?.address || !tok.symbol) return null;
  return {
    kind: "coin",
    address: tok.address,
    symbol: tok.symbol,
    name: tok.name ?? tok.symbol,
    priceUsd: num(p.priceUsd),
    change24h: p.priceChange?.h24 ?? null,
    volume24hUsd: p.volume?.h24 ?? null,
    iconUrl: p.info?.imageUrl,
  };
}

async function dexPairs(url: string): Promise<DexScreenerPair[]> {
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
  if (!r.ok) return [];
  const d = (await r.json()) as DexScreenerPair[] | { pairs?: DexScreenerPair[] };
  return Array.isArray(d) ? d : (d.pairs ?? []);
}

export async function GET(request: Request) {
  const rl = await checkRateLimitAsync(`trade-markets:${getClientIp(request)}`, 60, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 64);
  const kind = searchParams.get("kind") ?? "all"; // all | stocks | coins

  const out: TradeMarket[] = [];

  if (kind !== "coins") {
    try {
      const stocks = await fetchAllCoinbaseTokenizedStocks({});
      const ql = q.toLowerCase();
      const filtered = stocks
        .filter(
          (s) =>
            !ql ||
            s.symbol.toLowerCase().includes(ql) ||
            s.name.toLowerCase().includes(ql) ||
            s.underlyingTicker.toLowerCase().includes(ql)
        )
        .sort((a, b) => b.volume24hUsd - a.volume24hUsd)
        .slice(0, 60);
      for (const s of filtered) {
        out.push({
          kind: "stock",
          address: s.address,
          symbol: s.symbol,
          name: s.name,
          priceUsd: s.nav || null,
          change24h: s.change24h,
          volume24hUsd: s.volume24hUsd,
          iconUrl: s.iconUrl,
          decimals: s.decimals,
        });
      }
    } catch (e) {
      console.error("[/api/trade/markets] stocks", e);
    }
  }

  if (kind !== "stocks") {
    try {
      const pairs = q
        ? (await dexPairs(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`)).filter(
            (p) => (p.chainId ?? "").toLowerCase() === "base"
          )
        : await dexPairs(`https://api.dexscreener.com/tokens/v1/base/${COIN_SEEDS.join(",")}`);
      const seedSet = new Set(COIN_SEEDS.map((a) => a.toLowerCase()));
      pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
      const seen = new Set<string>();
      for (const p of pairs) {
        if (!q && !seedSet.has((p.baseToken?.address ?? "").toLowerCase())) continue;
        const m = pairToCoin(p);
        if (!m) continue;
        const key = m.address.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(m);
        if (seen.size >= 30) break;
      }
    } catch (e) {
      console.error("[/api/trade/markets] coins", e);
    }
  }

  return NextResponse.json(
    { ok: true, markets: out },
    { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=60" } }
  );
}
