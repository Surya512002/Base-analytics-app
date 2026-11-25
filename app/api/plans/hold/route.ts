import { NextResponse } from "next/server";
import { limitByIp } from "@/lib/api/rate-limit";
import { submitHold } from "@/lib/plans/rules-service";
import { orderBookFor, readHold, realDeps } from "@/lib/plans/rules-deps";

export const dynamic = "force-dynamic";

const MAX_BODY = 2_000;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** "Wait before the first buy" for plans the signer is about to create. Signed by that wallet. */
export async function POST(req: Request) {
  const limited = await limitByIp(req, "plan-hold-write", 20);
  if (limited) return limited;
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ ok: false, error: "Request too large." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const r = await submitHold(body, realDeps);
  return r.ok ? NextResponse.json({ ok: true, from: r.from, until: r.until }) : NextResponse.json({ ok: false, error: r.error }, { status: r.status });
}

/** The wallet's running hold, without its signature, so a new one can keep covering the earlier plans. */
export async function GET(req: Request) {
  const limited = await limitByIp(req, "plan-hold-read", 60);
  if (limited) return limited;
  const url = new URL(req.url);
  const chainId = Number(url.searchParams.get("chainId"));
  const owner = url.searchParams.get("owner") ?? "";
  if (!orderBookFor(chainId) || !ADDRESS_RE.test(owner)) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  const h = await readHold(chainId, owner);
  return NextResponse.json({ ok: true, hold: h ? { from: h.from, until: h.until } : null });
}
