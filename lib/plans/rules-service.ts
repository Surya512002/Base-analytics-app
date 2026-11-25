import { validateRules, rulesMessage, type PlanRules } from "@/limit-orders/shared/planRules";

export const MAX_SIGNATURE_AGE_SEC = 10 * 60;
const PLAN_OPEN = 1;

export interface StoredRules {
  rules: PlanRules | null;
  issuedAt: number;
  signer: string;
  signature: string;
}

export interface RulesDeps {
  nowSec: () => number;
  orderBookFor: (chainId: number) => string | null;
  /** Owner and status of the plan on-chain, or null if it does not exist. */
  readPlan: (chainId: number, planId: string) => Promise<{ owner: string; status: number } | null>;
  /** Signature check that also accepts smart-contract wallets (ERC-1271). */
  verify: (a: { chainId: number; address: string; message: string; signature: string }) => Promise<boolean>;
  load: (chainId: number, planId: string) => Promise<StoredRules | null>;
  save: (chainId: number, planId: string, entry: StoredRules) => Promise<boolean>;
}

export type SubmitResult = { ok: true; rules: PlanRules | null } | { ok: false; status: number; error: string };

const SIG_RE = /^0x[0-9a-fA-F]{130,4096}$/;
const PLAN_RE = /^[1-9]\d{0,11}$/;

/**
 * Accept rules for a plan only if its on-chain owner signed exactly this text, recently, and newer
 * than anything already stored. A rules object of null removes the rules (also signed).
 */
export async function submitRules(body: unknown, deps: RulesDeps): Promise<SubmitResult> {
  if (typeof body !== "object" || body === null) return { ok: false, status: 400, error: "Invalid request." };
  const b = body as Record<string, unknown>;
  const chainId = b.chainId;
  const planId = b.planId;
  const issuedAt = b.issuedAt;
  const signature = b.signature;

  if (typeof chainId !== "number" || !Number.isInteger(chainId)) return { ok: false, status: 400, error: "Unsupported network." };
  const orderBook = deps.orderBookFor(chainId);
  if (!orderBook) return { ok: false, status: 400, error: "Unsupported network." };
  if (typeof planId !== "string" || !PLAN_RE.test(planId)) return { ok: false, status: 400, error: "Invalid plan." };
  if (typeof issuedAt !== "number" || !Number.isInteger(issuedAt)) return { ok: false, status: 400, error: "Invalid time." };
  if (typeof signature !== "string" || !SIG_RE.test(signature)) return { ok: false, status: 400, error: "Invalid signature." };

  const now = deps.nowSec();
  if (Math.abs(now - issuedAt) > MAX_SIGNATURE_AGE_SEC) return { ok: false, status: 400, error: "The signature is too old or its clock is off. Sign again." };

  let rules: PlanRules | null = null;
  if (b.rules !== null) {
    const v = validateRules(b.rules);
    if (!v.ok) return { ok: false, status: 400, error: v.error };
    rules = v.rules;
  }

  const plan = await deps.readPlan(chainId, planId);
  if (!plan) return { ok: false, status: 404, error: "That plan was not found." };
  if (plan.status !== PLAN_OPEN) return { ok: false, status: 409, error: "That plan is no longer running." };

  const message = rulesMessage({ chainId, orderBook, planId, rules, issuedAt });
  const valid = await deps.verify({ chainId, address: plan.owner, message, signature });
  if (!valid) return { ok: false, status: 401, error: "The signature does not match the plan owner." };

  const existing = await deps.load(chainId, planId);
  if (existing && existing.issuedAt >= issuedAt) return { ok: false, status: 409, error: "A newer change was already saved. Sign again." };

  const saved = await deps.save(chainId, planId, { rules, issuedAt, signer: plan.owner.toLowerCase(), signature });
  if (!saved) return { ok: false, status: 503, error: "Could not save the rules right now. Try again." };
  return { ok: true, rules };
}

/**
 * What the keeper must do with a stored entry: re-check that the owner really signed it (so a
 * tampered store cannot hold back someone else's plan) and that it is for this plan owner.
 */
export async function entryIsAuthentic(
  e: StoredRules,
  ctx: { chainId: number; orderBook: string; planId: string; owner: string },
  verify: RulesDeps["verify"]
): Promise<boolean> {
  if (e.signer.toLowerCase() !== ctx.owner.toLowerCase()) return false;
  const message = rulesMessage({ chainId: ctx.chainId, orderBook: ctx.orderBook, planId: ctx.planId, rules: e.rules, issuedAt: e.issuedAt });
  return verify({ chainId: ctx.chainId, address: ctx.owner, message, signature: e.signature });
}
