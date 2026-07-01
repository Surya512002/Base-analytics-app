import { NextResponse } from "next/server";
import { buildAllMarkets } from "@/lib/predictions/market-engine";
import { PROTOCOL_FEE_BPS, PROTOCOL_FEE_LABEL } from "@/lib/constants/predictions";
import { APP_TREASURY } from "@/lib/constants/treasury";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function fetchSpotPrices(): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd",
      { next: { revalidate: 30 } }
    );
    if (!res.ok) throw new Error("price fetch failed");
    const data = (await res.json()) as {
      bitcoin?: { usd: number };
      ethereum?: { usd: number };
      solana?: { usd: number };
    };
    return {
      bitcoin: data.bitcoin?.usd ?? 0,
      ethereum: data.ethereum?.usd ?? 0,
      solana: data.solana?.usd ?? 0,
    };
  } catch {
    return { bitcoin: 97000, ethereum: 3600, solana: 145 };
  }
}

export async function GET() {
  const prices = await fetchSpotPrices();
  const markets = buildAllMarkets(prices);
  return NextResponse.json({
    markets,
    prices,
    protocolFeeBps: PROTOCOL_FEE_BPS,
    protocolFeeLabel: PROTOCOL_FEE_LABEL,
    treasury: APP_TREASURY,
    updatedAt: new Date().toISOString(),
  });
}
