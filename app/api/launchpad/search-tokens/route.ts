import { NextResponse } from "next/server";
import type { DexScreenerPair } from "@/lib/launchpad/dexscreener";
import type { TokenSearchHit } from "@/lib/launchpad/token-search";

export const dynamic = "force-dynamic";

type DexSearchResp = {
  pairs?: DexScreenerPair[];
};

/** Search any Base-listed ERC-20 by name/symbol/pair (DexScreener). Used by swap token picker. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ tokens: [] as TokenSearchHit[] });
  }

  const query = q.slice(0, 64);

  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!r.ok) {
      return NextResponse.json({ tokens: [] as TokenSearchHit[] });
    }
    const data = (await r.json()) as DexSearchResp;
    const byAddr = new Map<string, TokenSearchHit>();

    for (const pair of data.pairs ?? []) {
      if ((pair.chainId ?? "").toLowerCase() !== "base") continue;
      const addr = pair.baseToken?.address?.trim().toLowerCase();
      if (!addr?.startsWith("0x") || addr.length !== 42) continue;

      const liq = pair.liquidity?.usd ?? 0;
      const vol = pair.volume?.h24 ?? 0;
      if (liq < 50 && vol < 100) continue;

      const existing = byAddr.get(addr);
      if (existing && existing.liquidityUsd >= liq) continue;

      byAddr.set(addr, {
        address: addr,
        symbol: (pair.baseToken?.symbol || "TOKEN").slice(0, 24),
        name: (pair.baseToken?.name || pair.baseToken?.symbol || "Token").slice(0, 64),
        imageUrl: pair.info?.imageUrl,
        liquidityUsd: liq,
        volume24h: vol,
        priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : undefined,
      });
    }

    const tokens = [...byAddr.values()]
      .sort(
        (a, b) =>
          b.liquidityUsd + b.volume24h * 0.2 - (a.liquidityUsd + a.volume24h * 0.2)
      )
      .slice(0, 24);

    return NextResponse.json({ tokens });
  } catch (err) {
    console.error("[launchpad/search-tokens]", err);
    return NextResponse.json({ tokens: [] as TokenSearchHit[] });
  }
}
