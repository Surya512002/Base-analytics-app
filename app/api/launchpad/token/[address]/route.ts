import { NextResponse } from "next/server";

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

function isAddressLike(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ address: string }> }
) {
  const { address } = await ctx.params;
  const token = (address || "").trim();
  if (!isAddressLike(token)) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${token}`,
      { cache: "no-store" }
    );
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

    return NextResponse.json({ pairs });
  } catch (e) {
    console.error("[launchpad/token]", e);
    return NextResponse.json(
      { error: "Token stats failed" },
      { status: 500 }
    );
  }
}

