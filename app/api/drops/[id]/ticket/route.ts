import { NextResponse } from "next/server";
import { checkRateLimitAsync, rateLimitResponse } from "@/lib/api/rate-limit";
import { errorResponse, limitIp, requireWallet } from "@/lib/drops/http";
import { defaultDeps, issueTicket, parseDropId } from "@/lib/drops/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/drops/:id/ticket { wallet } → a signed ticket for the signed-in wallet's next claim,
 * after re-checking tasks that can change. The ticket names the wallet, its claim number and the
 * amount, and expires in 10 minutes, so it's useless to anyone else.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "ticket", 20, 60_000);
  if (limited) return limited;
  let body: { wallet?: string };
  try {
    body = (await req.json()) as { wallet?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const auth = await requireWallet(body.wallet);
  if (!auth.ok) return auth.res;
  const perWallet = await checkRateLimitAsync(`drops-ticket-wallet:${auth.wallet}`, 10, 60_000);
  if (!perWallet.ok) return rateLimitResponse(perWallet.retryAfterSec);
  try {
    const id = parseDropId((await ctx.params).id);
    return NextResponse.json({ ticket: await issueTicket(defaultDeps(), id, auth.wallet) });
  } catch (err) {
    return errorResponse(err);
  }
}
