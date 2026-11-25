import { NextResponse } from "next/server";
import { limitByIp } from "@/lib/api/rate-limit";
import { alchemyRpcForKey, getAlchemyKey } from "@/lib/constants/env";
import { orderBookFor } from "@/lib/plans/rules-deps";
import { alchemyDeps, loadPlanHistory } from "@/lib/plans/history-server";

export const dynamic = "force-dynamic";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const TTL_MS = 20_000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; body: object }>();

/** Past runs of a wallet's recurring plans (public on-chain data). Base mainnet only. */
export async function GET(req: Request) {
  const limited = await limitByIp(req, "plan-history", 20);
  if (limited) return limited;
  const url = new URL(req.url);
  const chainId = Number(url.searchParams.get("chainId"));
  const owner = (url.searchParams.get("owner") ?? "").toLowerCase();
  if (!ADDRESS_RE.test(owner)) return NextResponse.json({ ok: false, error: "Invalid wallet." }, { status: 400 });
  const orderBook = orderBookFor(chainId);
  if (!orderBook) return NextResponse.json({ ok: false, error: "Unsupported network." }, { status: 400 });
  const key = getAlchemyKey();
  // The address index we rely on is only set up for Base mainnet.
  if (chainId !== 8453 || !key) return NextResponse.json({ ok: true, supported: false, fills: [], partial: false });

  const hit = cache.get(owner);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body);
  try {
    const { fills, partial } = await loadPlanHistory({ orderBook, owner }, alchemyDeps(alchemyRpcForKey(key)));
    const body = { ok: true, supported: true, fills, partial };
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(owner, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    console.error("[/api/plans/history]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Plan history is unavailable right now." }, { status: 502 });
  }
}
