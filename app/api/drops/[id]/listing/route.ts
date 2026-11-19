import { NextResponse } from "next/server";
import { requireSiweSession } from "@/lib/auth/siwe-session";
import { errorResponse, limitIp } from "@/lib/drops/http";
import { defaultDeps, parseDropId, readListing, saveListing } from "@/lib/drops/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/drops/:id/listing → how the drop is listed publicly (or null). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "listing", 120, 60_000);
  if (limited) return limited;
  try {
    return NextResponse.json({ listing: await readListing(defaultDeps(), parseDropId((await ctx.params).id)) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PUT /api/drops/:id/listing { creator, listing | null } → list the drop in the public feed (or remove it). */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "listing-write", 20, 60_000);
  if (limited) return limited;
  try {
    const id = parseDropId((await ctx.params).id);
    let body: { creator?: string; listing?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const session = await requireSiweSession(body.creator);
    if (!session.ok) return NextResponse.json({ error: session.error, requiresAuth: true }, { status: session.status });
    const listing = await saveListing(defaultDeps(), id, session.address, body.listing ?? null);
    return NextResponse.json({ listing });
  } catch (err) {
    return errorResponse(err);
  }
}
