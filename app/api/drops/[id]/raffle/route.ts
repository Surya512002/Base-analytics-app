import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { errorResponse, limitIp, requireWallet } from "@/lib/drops/http";
import { defaultDeps, drawRaffle, enterRaffle, parseDropId, raffleStatus } from "@/lib/drops/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/drops/:id/raffle?wallet=0x… → entrants, draw time, seed commit, result (and whether this wallet entered/won). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "raffle", 60, 60_000);
  if (limited) return limited;
  try {
    const id = parseDropId((await ctx.params).id);
    const w = new URL(req.url).searchParams.get("wallet")?.toLowerCase();
    return NextResponse.json(await raffleStatus(defaultDeps(), id, w && isAddress(w) ? w : undefined));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/drops/:id/raffle { action: "enter", wallet } → enter (SIWE as that wallet; tasks re-checked).
 * POST /api/drops/:id/raffle { action: "draw" } → draw after the draw time (anyone; the first draw is final).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "raffle-write", 20, 60_000);
  if (limited) return limited;
  let body: { action?: string; wallet?: string };
  try {
    body = (await req.json()) as { action?: string; wallet?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const id = parseDropId((await ctx.params).id);
    if (body.action === "draw") return NextResponse.json({ result: await drawRaffle(defaultDeps(), id) });
    if (body.action !== "enter") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    const auth = await requireWallet(body.wallet);
    if (!auth.ok) return auth.res;
    return NextResponse.json(await enterRaffle(defaultDeps(), id, auth.wallet));
  } catch (err) {
    return errorResponse(err);
  }
}
