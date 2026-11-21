import { NextResponse } from "next/server";
import { requireSiweSession } from "@/lib/auth/siwe-session";
import { getReadyRedis } from "@/lib/redis-cache";
import { getReferral, joinReferral, referralCode } from "@/lib/referral/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMPTY_GET = { invites: 0, bonusXp: 0, referredBy: null };
const EMPTY_POST = { bonusXp: 0, referredBy: null };

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address")?.toLowerCase();
  if (!address?.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const redis = await getReadyRedis();
  if (!redis) return NextResponse.json(EMPTY_GET);
  try {
    return NextResponse.json(await getReferral(redis, address));
  } catch {
    return NextResponse.json(EMPTY_GET);
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as { address?: string; referrer?: string };
  const address = body.address?.toLowerCase();
  const referrer = body.referrer?.toLowerCase().trim();

  if (!address?.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const session = await requireSiweSession(address);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }
  if (!referrer || referrer === address || referrer === referralCode(address)) {
    return NextResponse.json(EMPTY_POST);
  }
  const redis = await getReadyRedis();
  if (!redis) return NextResponse.json(EMPTY_POST);
  try {
    return NextResponse.json(await joinReferral(redis, address, referrer));
  } catch (e) {
    console.error("[referral]", e);
    return NextResponse.json(EMPTY_POST);
  }
}
