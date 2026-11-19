import { NextResponse } from "next/server";
import { requireSiweSession } from "@/lib/auth/siwe-session";
import { errorResponse, limitIp } from "@/lib/drops/http";
import { currentLiveCode, defaultDeps, parseDropId } from "@/lib/drops/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/drops/:id/live-code?creator=0x…&taskId=t1 → the current 6-digit event code and how many
 * seconds it stays valid. Creator only (SIWE), so it can be shown on a screen at the event.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "live-code", 120, 60_000);
  if (limited) return limited;
  const sp = new URL(req.url).searchParams;
  const session = await requireSiweSession(sp.get("creator") ?? undefined);
  if (!session.ok) return NextResponse.json({ error: session.error, requiresAuth: true }, { status: session.status });
  const taskId = sp.get("taskId") ?? "";
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(taskId)) return NextResponse.json({ error: "Invalid task" }, { status: 400 });
  try {
    const id = parseDropId((await ctx.params).id);
    return NextResponse.json(await currentLiveCode(defaultDeps(), id, session.address, taskId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
