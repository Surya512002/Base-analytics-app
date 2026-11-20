import { NextResponse } from "next/server";
import { limitIp } from "@/lib/drops/http";
import { dropsStatus } from "@/lib/drops/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/drops/status → which parts of the Drops setup are ready (pass/fail only, no values). */
export async function GET(req: Request) {
  const limited = await limitIp(req, "status", 30, 60_000);
  if (limited) return limited;
  const s = await dropsStatus();
  return NextResponse.json(s, { status: s.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
