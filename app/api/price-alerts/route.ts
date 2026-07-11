import { NextResponse } from "next/server";
import {
  listPriceAlerts,
  removePriceAlert,
  upsertPriceAlert,
} from "@/lib/price-alerts/store";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAddress(addr: string): boolean {
  return /^0x[a-f0-9]{40}$/.test(addr.trim().toLowerCase());
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimitAsync(`price-alerts:${ip}`, 60, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet")?.trim().toLowerCase();
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }

  const alerts = await listPriceAlerts(wallet);
  return NextResponse.json({ alerts });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimitAsync(`price-alerts-post:${ip}`, 30, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  let body: {
    wallet?: string;
    address?: string;
    symbol?: string;
    direction?: "above" | "below";
    priceUsd?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const wallet = body.wallet?.trim().toLowerCase();
  const address = body.address?.trim().toLowerCase();
  const symbol = body.symbol?.trim();
  const direction = body.direction === "below" ? "below" : "above";
  const priceUsd = Number(body.priceUsd);

  if (!wallet || !isAddress(wallet) || !address || !isAddress(address) || !symbol) {
    return NextResponse.json({ error: "Invalid alert payload" }, { status: 400 });
  }
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    return NextResponse.json({ error: "Invalid priceUsd" }, { status: 400 });
  }

  const alert = await upsertPriceAlert({
    wallet,
    address,
    symbol,
    direction,
    priceUsd,
  });

  return NextResponse.json({ ok: true, alert });
}

export async function DELETE(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimitAsync(`price-alerts-del:${ip}`, 30, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet")?.trim().toLowerCase();
  const address = searchParams.get("address")?.trim().toLowerCase();

  if (!wallet || !isAddress(wallet) || !address || !isAddress(address)) {
    return NextResponse.json({ error: "wallet and address required" }, { status: 400 });
  }

  await removePriceAlert(wallet, address);
  return NextResponse.json({ ok: true });
}
