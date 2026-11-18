/** Shared request handling for /api/drops routes. */
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { requireSiweSession } from "@/lib/auth/siwe-session";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import { DropError } from "./service";

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof DropError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("[drops]", err);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
}

/** Per-IP rate limit; returns a response to send back when limited. */
export async function limitIp(req: Request, bucket: string, max: number, windowMs: number) {
  const r = await checkRateLimitAsync(`drops-${bucket}-ip:${getClientIp(req)}`, max, windowMs);
  return r.ok ? null : rateLimitResponse(r.retryAfterSec);
}

/**
 * The wallet must be signed in (SIWE) as itself: task answers, attempts and tickets belong to
 * that wallet, so nobody can burn someone else's quiz attempts or bind their accounts.
 */
export async function requireWallet(raw: unknown): Promise<{ ok: true; wallet: `0x${string}` } | { ok: false; res: NextResponse }> {
  const wallet = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!isAddress(wallet)) return { ok: false, res: NextResponse.json({ error: "Invalid wallet" }, { status: 400 }) };
  const session = await requireSiweSession(wallet);
  if (!session.ok) {
    return { ok: false, res: NextResponse.json({ error: session.error, requiresAuth: true }, { status: session.status }) };
  }
  return { ok: true, wallet: wallet as `0x${string}` };
}
