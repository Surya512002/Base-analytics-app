import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ entries: [], totalCount: 0, weekNumber: 0 });
}

export async function POST() {
  return NextResponse.json({ ok: false, error: "Leaderboard deprecated" }, { status: 410 });
}
