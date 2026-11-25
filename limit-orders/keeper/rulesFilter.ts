/**
 * Plan rules for the keeper. The keeper still only runs a plan when the contract says it is due.
 * This only adds "and the owner's own rules allow it right now". It can delay a run, never speed one up,
 * and never change what the run does.
 *
 * Trust: every rule set is signed by the plan owner. The keeper re-checks that signature itself, so a
 * tampered store or API cannot hold back someone else's plan. A rule set that fails the check is ignored.
 * If the rules store cannot be reached, the last rules the keeper already knows are used. A plan the
 * keeper has never managed to look up waits a short while first, so a blip cannot skip its owner's wishes.
 *
 * A signed "hold" covers the gap between creating a plan and saving its rules: covered plans without
 * rules wait until rules are saved (or "no rules" is chosen) or the hold runs out.
 */
import { evaluateRules, holdCovers, holdMessage, rulesMessage, validateRules, type PlanHold, type PlanRules, type PricePoint } from "../shared/planRules";

export interface StoredEntry {
  rules: PlanRules | null;
  issuedAt: number;
  signer: string;
  signature: string;
}

export interface StoredHold extends PlanHold {
  signature: string;
}

export interface Fetched {
  /** Plan id to stored rules. */
  entries: Record<string, StoredEntry>;
  /** Lower-case owner address to that owner's running hold. */
  holds: Record<string, StoredHold>;
}

export interface RulesFilterDeps {
  /** Bulk read from the app for these plans and their owners. Throws on any failure. */
  fetchEntries(plans: Array<{ id: string; owner: string }>): Promise<Fetched>;
  verify(a: { address: string; message: string; signature: string }): Promise<boolean>;
  /** Current Chainlink price in USD (the one the contract uses), or null. */
  readPrice(stockToken: string): Promise<number | null>;
  /** Daily closes for about the last 35 days, or an empty list. */
  fetchHistory(stockToken: string): Promise<PricePoint[]>;
  now(): Date;
  log(msg: string): void;
}

export interface PlanInfo {
  owner: string;
  stockToken: string;
}

export type FilterDecision = { run: true } | { run: false; reason: string };

const DEFAULT_REFRESH_MS = 60_000;
const HISTORY_TTL_MS = 15 * 60_000;
/** How soon the store may be asked again when a plan appears that it has not covered yet. */
const NEW_PLAN_GAP_MS = 4_000;
/** How long a plan that could never be looked up waits before running without rules. */
const UNSEEN_GRACE_MS = 2 * 60_000;

export function createRulesFilter(cfg: { enabled: boolean; chainId: number; orderBook: string; refreshMs?: number }, deps: RulesFilterDeps) {
  const refreshMs = cfg.refreshMs && cfg.refreshMs >= 500 ? cfg.refreshMs : DEFAULT_REFRESH_MS;
  const entries = new Map<string, StoredEntry>();
  const holds = new Map<string, StoredHold>();
  const covered = new Set<string>(); // plan ids included in a successful lookup
  const firstSeen = new Map<string, number>();
  const authentic = new Map<string, boolean>(); // planId + signature -> verified
  const history = new Map<string, { at: number; data: PricePoint[] }>();
  const lastLogged = new Map<string, string>();
  let lastRefresh = 0;
  let outage = false;

  async function refresh(plans: Array<{ id: string; owner: string }>): Promise<void> {
    if (!cfg.enabled || plans.length === 0) return;
    const now = deps.now().getTime();
    for (const p of plans) if (!firstSeen.has(p.id)) firstSeen.set(p.id, now);
    // A plan not yet looked up is due the moment it exists, so ask again right away for it.
    const unseen = plans.some((p) => !covered.has(p.id));
    if (now - lastRefresh < (unseen ? Math.min(NEW_PLAN_GAP_MS, refreshMs) : refreshMs)) return;
    lastRefresh = now;
    try {
      const got = await deps.fetchEntries(plans);
      entries.clear();
      for (const [id, e] of Object.entries(got.entries)) entries.set(id, e);
      holds.clear();
      for (const [owner, h] of Object.entries(got.holds)) holds.set(owner.toLowerCase(), h);
      for (const p of plans) covered.add(p.id);
      if (outage) deps.log("rules store reachable again");
      outage = false;
    } catch (err) {
      // Keep the rules we already know. Plans we know nothing about run as before.
      if (!outage) deps.log(`rules store unreachable (${err instanceof Error ? err.message : String(err)}); using the rules already known`);
      outage = true;
    }
  }

  async function isAuthentic(planId: string, plan: PlanInfo, e: StoredEntry): Promise<boolean> {
    const k = `${planId}:${e.signature}:${e.issuedAt}`;
    const hit = authentic.get(k);
    if (hit !== undefined) return hit;
    let ok = false;
    if (e.signer.toLowerCase() === plan.owner.toLowerCase()) {
      const message = rulesMessage({ chainId: cfg.chainId, orderBook: cfg.orderBook, planId, rules: e.rules, issuedAt: e.issuedAt });
      try {
        ok = await deps.verify({ address: plan.owner, message, signature: e.signature });
      } catch {
        ok = false;
      }
    }
    authentic.set(k, ok);
    if (!ok) deps.log(`plan ${planId}: stored rules failed the signature check, ignoring them`);
    return ok;
  }

  async function holdIsAuthentic(plan: PlanInfo, h: StoredHold): Promise<boolean> {
    const k = `hold:${plan.owner.toLowerCase()}:${h.signature}:${h.from}:${h.until}:${h.issuedAt}`;
    const hit = authentic.get(k);
    if (hit !== undefined) return hit;
    let ok = false;
    try {
      const message = holdMessage({ chainId: cfg.chainId, orderBook: cfg.orderBook, owner: plan.owner, from: h.from, until: h.until, issuedAt: h.issuedAt });
      ok = await deps.verify({ address: plan.owner, message, signature: h.signature });
    } catch {
      ok = false;
    }
    authentic.set(k, ok);
    if (!ok) deps.log(`owner ${plan.owner}: stored hold failed the signature check, ignoring it`);
    return ok;
  }

  const say = (planId: string, reason: string) => {
    if (lastLogged.get(planId) === reason) return;
    lastLogged.set(planId, reason);
    deps.log(reason ? `plan ${planId}: waiting, ${reason}` : `plan ${planId}: rules allow the run`);
  };

  /** A plan without usable rules: it runs, unless its owner asked to wait while choosing rules. */
  async function withoutRules(planId: string, plan: PlanInfo): Promise<FilterDecision> {
    const h = holds.get(plan.owner.toLowerCase());
    if (h && holdCovers(h, planId, Math.floor(deps.now().getTime() / 1000)) && (await holdIsAuthentic(plan, h))) {
      const reason = `the owner is choosing rules (hold ends ${new Date(h.until * 1000).toISOString()})`;
      say(planId, reason);
      return { run: false, reason };
    }
    return { run: true };
  }

  async function priceHistory(stockToken: string): Promise<PricePoint[]> {
    const k = stockToken.toLowerCase();
    const hit = history.get(k);
    const now = deps.now().getTime();
    if (hit && now - hit.at < HISTORY_TTL_MS) return hit.data;
    let data: PricePoint[] = [];
    try {
      data = await deps.fetchHistory(stockToken);
    } catch {
      data = [];
    }
    // An empty answer is only remembered briefly so one failure does not hide history for 15 minutes.
    history.set(k, { at: data.length ? now : now - HISTORY_TTL_MS + 30_000, data });
    return data;
  }

  /** May this due plan run now? */
  async function check(planId: string, plan: PlanInfo): Promise<FilterDecision> {
    if (!cfg.enabled) return { run: true };
    if (!covered.has(planId)) {
      const now = deps.now().getTime();
      if (!firstSeen.has(planId)) firstSeen.set(planId, now);
      if (now - (firstSeen.get(planId) as number) < UNSEEN_GRACE_MS) {
        const reason = "its rules have not been read yet";
        say(planId, reason);
        return { run: false, reason };
      }
    }
    const e = entries.get(planId);
    if (!e || !(await isAuthentic(planId, plan, e))) return withoutRules(planId, plan);
    if (!e.rules) return { run: true }; // the owner chose "no rules", which also ends a hold
    const v = validateRules(e.rules);
    if (!v.ok) return withoutRules(planId, plan); // a rule set we cannot read is not a rule set

    const needsPrice = Boolean(v.rules.dip || v.rules.skipIfUp);
    const price = needsPrice ? await deps.readPrice(plan.stockToken) : 0;
    const hist = needsPrice ? await priceHistory(plan.stockToken) : [];
    const d = evaluateRules(v.rules, { now: deps.now(), price: price ?? Number.NaN, history: hist });
    say(planId, d.run ? "" : d.reason);
    return d;
  }

  return { refresh, check, _entries: entries };
}
