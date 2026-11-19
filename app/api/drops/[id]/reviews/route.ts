import { NextResponse } from "next/server";
import { requireSiweSession } from "@/lib/auth/siwe-session";
import { errorResponse, limitIp } from "@/lib/drops/http";
import { decideReview, defaultDeps, listReviews, parseDropId } from "@/lib/drops/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/drops/:id/reviews?creator=0x… → submissions to review (SIWE as the drop's creator). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "reviews", 60, 60_000);
  if (limited) return limited;
  const session = await requireSiweSession(new URL(req.url).searchParams.get("creator") ?? undefined);
  if (!session.ok) return NextResponse.json({ error: session.error, requiresAuth: true }, { status: session.status });
  try {
    const id = parseDropId((await ctx.params).id);
    return NextResponse.json({ items: await listReviews(defaultDeps(), id, session.address) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/drops/:id/reviews { creator, wallet, taskId, approve, note? } → approve or reject one submission. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "reviews-write", 120, 60_000);
  if (limited) return limited;
  let body: { creator?: string; wallet?: unknown; taskId?: unknown; approve?: unknown; note?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const session = await requireSiweSession(body.creator);
  if (!session.ok) return NextResponse.json({ error: session.error, requiresAuth: true }, { status: session.status });
  try {
    const id = parseDropId((await ctx.params).id);
    await decideReview(defaultDeps(), id, session.address, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
