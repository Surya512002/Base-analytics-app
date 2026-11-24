/**
 * Plan rules for the keeper. The keeper still only runs a plan when the contract says it is due.
 * This only adds "and the owner's own rules allow it right now". It can delay a run, never speed one up,
 * and never change what the run does.
 *
 * Trust: every rule set is signed by the plan owner. The keeper re-checks that signature itself, so a
 * tampered store or API cannot hold back someone else's plan. A rule set that fails the check is ignored.
 * If the rules store cannot be reached, the last rules the keeper already knows are used.
 */
import { evaluateRules, rulesMessage, validateRules, type PlanRules, type PricePoint } from "../shared/planRules";

export interface StoredEntry {
  rules: PlanRules | null;
  issuedAt: number;
  signer: string;
  signature: string;
}

export interface RulesFilterDeps {
  /** Bulk read from the app: plan id to stored entry. Throws on any failure. */
  fetchEntries(ids: string[]): Promise<Record<string, StoredEntry>>;
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

export function createRulesFilter(cfg: { enabled: boolean; chainId: number; orderBook: string; refreshMs?: number }, deps: RulesFilterDeps) {
  const refreshMs = cfg.refreshMs && cfg.refreshMs >= 500 ? cfg.refreshMs : DEFAULT_REFRESH_MS;
  const entries = new Map<string, StoredEntry>();
  const authentic = new Map<string, boolean>(); // planId + signature -> verified
  const history = new Map<string, { at: number; data: PricePoint[] }>();
  const lastLogged = new Map<string, string>();
  let lastRefresh = 0;
  let outage = false;

  async function refresh(ids: string[]): Promise<void> {
    if (!cfg.enabled || ids.length === 0) return;
    const now = deps.now().getTime();
    if (now - lastRefresh < refreshMs) return;
    lastRefresh = now;
    try {
      const got = await deps.fetchEntries(ids);
      entries.clear();
      for (const [id, e] of Object.entries(got)) entries.set(id, e);
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
    const e = entries.get(planId);
    if (!e || !e.rules) return { run: true };
    if (!(await isAuthentic(planId, plan, e))) return { run: true };
    const v = validateRules(e.rules);
    if (!v.ok) return { run: true }; // a rule set we cannot read is not a rule set

    const needsPrice = Boolean(v.rules.dip || v.rules.skipIfUp);
    const price = needsPrice ? await deps.readPrice(plan.stockToken) : 0;
    const hist = needsPrice ? await priceHistory(plan.stockToken) : [];
    const d = evaluateRules(v.rules, { now: deps.now(), price: price ?? Number.NaN, history: hist });
    const reason = d.run ? "" : d.reason;
    if (lastLogged.get(planId) !== reason) {
      lastLogged.set(planId, reason);
      deps.log(d.run ? `plan ${planId}: rules allow the run` : `plan ${planId}: waiting, ${reason}`);
    }
    return d;
  }

  return { refresh, check, _entries: entries };
}
