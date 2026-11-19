import { NextResponse } from "next/server";
import { errorResponse, limitIp, requireWallet } from "@/lib/drops/http";
import { confirmClaim, defaultDeps, parseDropId } from "@/lib/drops/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/drops/:id/claimed { wallet } → after a claim confirms, make the wallet's random-split share permanent. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "claimed", 30, 60_000);
  if (limited) return limited;
  let body: { wallet?: string };
  try {
    body = (await req.json()) as { wallet?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const auth = await requireWallet(body.wallet);
  if (!auth.ok) return auth.res;
  try {
    return NextResponse.json(await confirmClaim(defaultDeps(), parseDropId((await ctx.params).id), auth.wallet));
  } catch (err) {
    return errorResponse(err);
  }
}
