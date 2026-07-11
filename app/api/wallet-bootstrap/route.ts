import { NextResponse } from "next/server";
import { bootstrapWalletAnalysis } from "@/lib/wallet/bootstrap";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimitAsync(`bootstrap:${ip}`, 40, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.trim().toLowerCase();

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const result = await bootstrapWalletAnalysis(address);
    if (!result) {
      return NextResponse.json({ error: "Bootstrap failed" }, { status: 500 });
    }
    return NextResponse.json({ ...result, bootstrapped: true });
  } catch (err) {
    console.error("[wallet-bootstrap]", err);
    return NextResponse.json({ error: "Bootstrap failed" }, { status: 500 });
  }
}
