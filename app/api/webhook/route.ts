import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Farcaster mini-app webhook stub (required by manifest). */
export async function POST() {
  return NextResponse.json({ success: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "base-analytics-webhook" });
}
