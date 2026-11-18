import { NextResponse } from "next/server";
import { requireSiweSession } from "@/lib/auth/siwe-session";
import { errorResponse, limitIp } from "@/lib/drops/http";
import { defaultDeps, loadDefinition, parseDropId, publicDefinition, saveDefinition } from "@/lib/drops/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/drops/:id → the drop's tasks as claimers see them (no answers). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "def", 120, 60_000);
  if (limited) return limited;
  try {
    const id = parseDropId((await ctx.params).id);
    const def = await loadDefinition(defaultDeps(), id);
    return NextResponse.json({ definition: def ? publicDefinition(def) : null });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PUT /api/drops/:id { creator, definition } → save the drop's tasks.
 * Needs a SIWE session for the drop's onchain creator.
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "def-write", 20, 60_000);
  if (limited) return limited;
  try {
    const id = parseDropId((await ctx.params).id);
    const raw = await req.text();
    if (raw.length > 64 * 1024) return NextResponse.json({ error: "Definition too large" }, { status: 413 });
    let body: { creator?: string; definition?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const session = await requireSiweSession(body.creator);
    if (!session.ok) return NextResponse.json({ error: session.error, requiresAuth: true }, { status: session.status });
    const def = await saveDefinition(defaultDeps(), id, session.address, body.definition);
    return NextResponse.json({ definition: publicDefinition(def) });
  } catch (err) {
    return errorResponse(err);
  }
}
