import { NextResponse } from "next/server";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

type DexScreenerPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  priceNative?: string;
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number };
  txns?: {
    h24?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
    m5?: { buys?: number; sells?: number };
  };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
};

type DexScreenerResp = {
  pairs?: DexScreenerPair[];
};

const CACHE_TTL_MS = 90_000;
const pairCache = new Map<string, { pairs: DexScreenerPair[]; expires: number }>();

function isAddressLike(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ address: string }> }
) {
  const ip = getClientIp(req);
  const rl = await checkRateLimitAsync(`launchpad-token:${ip}`, 120, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { address } = await ctx.params;
  const token = (address || "").trim().toLowerCase();
  if (!isAddressLike(token)) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  const cached = pairCache.get(token);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(
      { pairs: cached.pairs },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  }

  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${token}`,
      {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(12_000),
      }
    );
    if (r.status === 429) {
      return NextResponse.json(
        { error: "DexScreener rate limited — retry shortly" },
        { status: 429, headers: { "Retry-After": "30" } }
      );
    }
    if (!r.ok) {
      return NextResponse.json(
        { error: "Failed to fetch token stats" },
        { status: 502 }
      );
    }
    const data = (await r.json()) as DexScreenerResp;
    const pairs = (data.pairs ?? [])
      .filter((p) => (p.chainId ?? "").toLowerCase() === "base")
      .slice(0, 8);

    pairCache.set(token, { pairs, expires: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(
      { pairs },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (e) {
    console.error("[launchpad/token]", e);
    return NextResponse.json(
      { error: "Token stats failed" },
      { status: 500 }
    );
  }
}
