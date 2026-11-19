import { NextResponse } from "next/server";
import { errorResponse, limitIp, requireWallet } from "@/lib/drops/http";
import { defaultDeps, getProgress, parseDropId } from "@/lib/drops/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/drops/:id/progress?wallet=0x… → the signed-in wallet's task progress and eligibility. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "progress", 60, 60_000);
  if (limited) return limited;
  const auth = await requireWallet(new URL(req.url).searchParams.get("wallet"));
  if (!auth.ok) return auth.res;
  try {
    const id = parseDropId((await ctx.params).id);
    return NextResponse.json(await getProgress(defaultDeps(), id, auth.wallet));
  } catch (err) {
    return errorResponse(err);
  }
}
