import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { limitByIp } from "@/lib/api/rate-limit";
import { submitRules } from "@/lib/plans/rules-service";
import { orderBookFor, readHold, readStored, realDeps } from "@/lib/plans/rules-deps";

export const dynamic = "force-dynamic";

const MAX_BODY = 4_000;
const MAX_IDS = 200;
const PLAN_RE = /^[1-9]\d{0,11}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function sameToken(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Save (or remove) a plan's rules. The plan owner must have signed the exact rules text. */
export async function POST(req: Request) {
  const limited = await limitByIp(req, "plan-rules-write", 20);
  if (limited) return limited;
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ ok: false, error: "Request too large." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const r = await submitRules(body, realDeps);
  return r.ok ? NextResponse.json({ ok: true, rules: r.rules }) : NextResponse.json({ ok: false, error: r.error }, { status: r.status });
}

/**
 * Read rules. One plan (`planId`) is public and returns only the rules and when they were signed.
 * Many plans (`ids`) is for the keeper: it needs the shared token and also gets the signatures, so it
 * can check them itself. With `owners` it also gets those wallets' first-buy holds.
 */
export async function GET(req: Request) {
  const limited = await limitByIp(req, "plan-rules-read", 120);
  if (limited) return limited;
  const url = new URL(req.url);
  const chainId = Number(url.searchParams.get("chainId"));
  if (!orderBookFor(chainId)) return NextResponse.json({ ok: false, error: "Unsupported network." }, { status: 400 });

  const planId = url.searchParams.get("planId");
  if (planId !== null) {
    if (!PLAN_RE.test(planId)) return NextResponse.json({ ok: false, error: "Invalid plan." }, { status: 400 });
    const e = await readStored(chainId, planId);
    return NextResponse.json({ ok: true, rules: e?.rules ?? null, issuedAt: e?.issuedAt ?? null });
  }

  const token = process.env.KEEPER_RULES_TOKEN;
  const auth = req.headers.get("authorization") ?? "";
  if (!token || token.length < 24) return NextResponse.json({ ok: false, error: "Not configured." }, { status: 503 });
  if (!auth.startsWith("Bearer ") || !sameToken(auth.slice(7), token)) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const ids = [...new Set((url.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean))];
  if (ids.length === 0 || ids.length > MAX_IDS || ids.some((i) => !PLAN_RE.test(i))) return NextResponse.json({ ok: false, error: "Invalid ids." }, { status: 400 });
  const entries: Record<string, unknown> = {};
  await Promise.all(ids.map(async (id) => {
    const e = await readStored(chainId, id);
    if (e) entries[id] = e;
  }));
  const owners = [...new Set((url.searchParams.get("owners") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean))];
  if (owners.length > MAX_IDS || owners.some((o) => !ADDRESS_RE.test(o))) return NextResponse.json({ ok: false, error: "Invalid owners." }, { status: 400 });
  const holds: Record<string, unknown> = {};
  await Promise.all(owners.map(async (o) => {
    const h = await readHold(chainId, o);
    if (h) holds[o] = h;
  }));
  return NextResponse.json({ ok: true, entries, holds });
}
