import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { requireSiweSession } from "@/lib/auth/siwe-session";
import { errorResponse, limitIp } from "@/lib/drops/http";
import { allowlistProof, defaultDeps, parseDropId, saveAllowlist } from "@/lib/drops/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/drops/:id/allowlist?wallet=0x… → that wallet's Merkle proof (or null if it isn't on
 * the list). Only the proof is returned, not the whole list.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "allow", 60, 60_000);
  if (limited) return limited;
  const wallet = new URL(req.url).searchParams.get("wallet")?.toLowerCase() ?? "";
  if (!isAddress(wallet)) return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  try {
    const id = parseDropId((await ctx.params).id);
    return NextResponse.json({ proof: await allowlistProof(defaultDeps(), id, wallet) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PUT /api/drops/:id/allowlist { creator, addresses } → creator (SIWE) uploads the list matching the onchain root. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "allow-write", 10, 60_000);
  if (limited) return limited;
  try {
    const id = parseDropId((await ctx.params).id);
    const raw = await req.text();
    if (raw.length > 600_000) return NextResponse.json({ error: "List too large" }, { status: 413 });
    let body: { creator?: string; addresses?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const session = await requireSiweSession(body.creator);
    if (!session.ok) return NextResponse.json({ error: session.error, requiresAuth: true }, { status: session.status });
    const count = await saveAllowlist(defaultDeps(), id, session.address, body.addresses);
    return NextResponse.json({ count });
  } catch (err) {
    return errorResponse(err);
  }
}
