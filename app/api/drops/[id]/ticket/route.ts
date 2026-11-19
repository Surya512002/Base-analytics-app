import { NextResponse } from "next/server";
import { checkRateLimitAsync, rateLimitResponse } from "@/lib/api/rate-limit";
import { errorResponse, limitIp, requireWallet } from "@/lib/drops/http";
import { defaultDeps, issueTicket, parseDropId } from "@/lib/drops/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEX = /^0x[0-9a-fA-F]*$/;
function cleanProof(p: unknown) {
  if (!p || typeof p !== "object") return undefined;
  const o = p as Record<string, unknown>;
  const hex = (v: unknown, max: number) => (typeof v === "string" && v.length <= max && HEX.test(v) ? (v as `0x${string}`) : undefined);
  const codeProof = Array.isArray(o.codeProof) ? o.codeProof.slice(0, 40).map((x) => hex(x, 66)).filter((x): x is `0x${string}` => Boolean(x)) : undefined;
  return { linkSig: hex(o.linkSig, 200), code: hex(o.code, 42), codeProof, codeSig: hex(o.codeSig, 200) };
}

/**
 * POST /api/drops/:id/ticket { wallet } → a signed ticket for the signed-in wallet's next claim,
 * after re-checking tasks that can change. The ticket names the wallet, its claim number and the
 * amount, and expires in 10 minutes, so it's useless to anyone else.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await limitIp(req, "ticket", 20, 60_000);
  if (limited) return limited;
  let body: { wallet?: string; proof?: { linkSig?: string; code?: string; codeProof?: string[]; codeSig?: string } };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const auth = await requireWallet(body.wallet);
  if (!auth.ok) return auth.res;
  const perWallet = await checkRateLimitAsync(`drops-ticket-wallet:${auth.wallet}`, 10, 60_000);
  if (!perWallet.ok) return rateLimitResponse(perWallet.retryAfterSec);
  try {
    const id = parseDropId((await ctx.params).id);
    return NextResponse.json({ ticket: await issueTicket(defaultDeps(), id, auth.wallet, cleanProof(body.proof)) });
  } catch (err) {
    return errorResponse(err);
  }
}
