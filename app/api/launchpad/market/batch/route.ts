import { NextResponse } from "next/server";
import { limitByIp } from "@/lib/api/rate-limit";
import { fetchMarketSummaries } from "@/lib/launchpad/dexscreener";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const limited = await limitByIp(req, "launchpad-market-batch", 60);
  if (limited) return limited;
  try {
    const body = (await req.json().catch(() => ({}))) as { addresses?: string[] };
    const addresses = Array.isArray(body.addresses)
      ? body.addresses
          .map((a) => a?.trim().toLowerCase())
          .filter((a) => a?.startsWith("0x") && a.length === 42)
      : [];

    if (!addresses.length) {
      return NextResponse.json({ markets: {} });
    }

    const unique = [...new Set(addresses)].slice(0, 80);
    const markets = await fetchMarketSummaries(unique);
    return NextResponse.json({ markets });
  } catch (e) {
    console.error("[launchpad/market/batch]", e);
    return NextResponse.json({ markets: {} }, { status: 500 });
  }
}
