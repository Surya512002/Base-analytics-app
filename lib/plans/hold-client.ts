import { DEFAULT_HOLD_SEC, holdMessage } from "@/limit-orders/shared/planRules";

/** Rules only do something once the keeper is set up for them, so the rules screens stay hidden until this is on. */
export const PLAN_RULES_ENABLED = process.env.NEXT_PUBLIC_PLAN_RULES_ENABLED === "true";

/**
 * Sign and save "wait before the first buy" for the plans about to be created. Must finish before the
 * create transaction is sent, so the keeper already knows when the plan appears. Throws if it cannot be saved.
 */
export async function saveFirstBuyHold(a: {
  chainId: number;
  orderBook: string;
  owner: string;
  /** The contract's next plan id, read just before. */
  nextPlanId: bigint;
  sign: (message: string) => Promise<string>;
  fetchImpl?: typeof fetch;
  nowSec?: number;
}): Promise<{ from: string; until: number }> {
  const f = a.fetchImpl ?? fetch;
  const issuedAt = a.nowSec ?? Math.floor(Date.now() / 1000);

  // A hold already running keeps covering its earlier plans.
  let from = a.nextPlanId;
  const cur = await f(`/api/plans/hold?chainId=${a.chainId}&owner=${a.owner}`);
  if (cur.ok) {
    const j = (await cur.json()) as { hold?: { from: string; until: number } | null };
    if (j.hold && j.hold.until > issuedAt && /^[1-9]\d*$/.test(j.hold.from) && BigInt(j.hold.from) < from) from = BigInt(j.hold.from);
  }

  const until = issuedAt + DEFAULT_HOLD_SEC;
  const message = holdMessage({ chainId: a.chainId, orderBook: a.orderBook, owner: a.owner, from: String(from), until, issuedAt });
  const signature = await a.sign(message);
  const r = await f("/api/plans/hold", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chainId: a.chainId, owner: a.owner, from: String(from), until, issuedAt, signature }),
  });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!r.ok || !j.ok) throw new Error(j.error ?? "Could not save that request.");
  return { from: String(from), until };
}
