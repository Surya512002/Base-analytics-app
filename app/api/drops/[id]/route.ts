import { NextResponse } from "next/server";
import { requireSiweSession } from "@/lib/auth/siwe-session";
import { errorResponse, limitIp } from "@/lib/drops/http";
import { defaultDeps, getPublicDefinition, parseDropId, publicDefinition, saveDefinition, updateTasks } from "@/lib/drops/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/drops/:id → the drop's tasks as claimers see them (no answers). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "def", 120, 60_000);
  if (limited) return limited;
  try {
    const id = parseDropId((await ctx.params).id);
    return NextResponse.json({ definition: await getPublicDefinition(defaultDeps(), id) });
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

/**
 * PATCH /api/drops/:id { creator, add?, remove? } → add or remove tasks (e.g. plan tomorrow's
 * task) on an unlocked drop. Needs a SIWE session for the drop's onchain creator.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "def-write", 30, 60_000);
  if (limited) return limited;
  try {
    const id = parseDropId((await ctx.params).id);
    const raw = await req.text();
    if (raw.length > 64 * 1024) return NextResponse.json({ error: "Too large" }, { status: 413 });
    let body: { creator?: string; add?: unknown; remove?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const session = await requireSiweSession(body.creator);
    if (!session.ok) return NextResponse.json({ error: session.error, requiresAuth: true }, { status: session.status });
    const deps = defaultDeps();
    await updateTasks(deps, id, session.address, { add: body.add, remove: body.remove });
    return NextResponse.json({ definition: await getPublicDefinition(deps, id) });
  } catch (err) {
    return errorResponse(err);
  }
}
