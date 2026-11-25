import { NextResponse } from "next/server";
import { limitByIp } from "@/lib/api/rate-limit";
import { alchemyRpcForKey, getAlchemyKey } from "@/lib/constants/env";
import { PRESET_SMART_MONEY } from "@/lib/smart-money/smart-money-store";
import { radarEvents, type RadarTransfer } from "@/lib/smart-money/radar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const limited = await limitByIp(req, "smart-money", 30);
  if (limited) return limited;
  const { searchParams } = new URL(req.url);
  const requested = searchParams.get("wallet")?.trim().toLowerCase() || PRESET_SMART_MONEY[0]!.address.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(requested)) return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });

  const label = PRESET_SMART_MONEY.find((w) => w.address.toLowerCase() === requested)?.label || `Wallet ${requested.slice(0, 6)}…`;
  // A failed lookup must say so: an empty list would read as "this wallet received nothing".
  const unavailable = () => NextResponse.json({ error: "Wallet activity is unavailable right now", wallets: PRESET_SMART_MONEY }, { status: 503 });

  const key = getAlchemyKey();
  if (!key) return unavailable();
  try {
    const res = await fetch(alchemyRpcForKey(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [{ fromBlock: "0x0", toBlock: "latest", toAddress: requested, category: ["erc20"], order: "desc", maxCount: "0x64", withMetadata: true, excludeZeroValue: true }],
      }),
    });
    const body = (await res.json()) as { result?: { transfers?: RadarTransfer[] } };
    if (!body.result?.transfers) return unavailable();
    return NextResponse.json({ wallets: PRESET_SMART_MONEY, recentBuys: radarEvents(body.result.transfers, requested, label), timestamp: Date.now() });
  } catch {
    return unavailable();
  }
}
