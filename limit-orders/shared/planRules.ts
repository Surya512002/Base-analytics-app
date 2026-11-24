// Smart rules for recurring-buy plans. Pure TypeScript, no imports, so the app and the keeper run the
// exact same code. See docs/PLAN-RULES.md for the threat model.
//
// A rule can only make a run WAIT. It never changes an amount, a destination or a fee, and the plan's
// money, price ceiling and cancel button stay on-chain. The keeper asks "is the plan due on-chain?"
// first, and only then "do this plan's rules allow it right now?".

export type RefDays = 7 | 30;

export interface PlanRules {
  v: 1;
  /** Days of the week the plan may run, 0 = Sunday ... 6 = Saturday, in US Eastern time (the stock market's clock). */
  weekdays?: number[];
  /** Minutes after midnight US Eastern. 570 to 630 is "the first hour after the market opens". */
  window?: { startMin: number; endMin: number };
  /** Only buy when the price is at least this far below its highest close of the last `refDays` days. */
  dip?: { refDays: RefDays; minDropPct: number };
  /** Skip the run when the price is up more than this over the last `days` days (do not chase). */
  skipIfUp?: { days: RefDays; pct: number };
}

export interface PricePoint {
  /** Unix seconds. */
  t: number;
  /** Close in USD. */
  c: number;
}

export interface RuleContext {
  now: Date;
  /** Current price in USD (the same Chainlink price the contract uses). */
  price: number;
  /** Daily closes, any order. Only needed for dip and skipIfUp. */
  history: PricePoint[];
}

export type Decision = { run: true } | { run: false; reason: string };

export const MAX_RULES_JSON = 600;
const DAY = 86_400;
const KEYS = new Set(["v", "weekdays", "window", "dip", "skipIfUp"]);
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);
const isRef = (n: unknown): n is RefDays => n === 7 || n === 30;

/** Strict validation of untrusted input: unknown keys, wrong types and out-of-range numbers are all refused. */
export function validateRules(input: unknown): { ok: true; rules: PlanRules } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return { ok: false, error: "Rules must be an object." };
  const o = input as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KEYS.has(k)) return { ok: false, error: `Unknown rule "${k}".` };
  if (o.v !== 1) return { ok: false, error: "Unsupported rules version." };
  const rules: PlanRules = { v: 1 };

  if (o.weekdays !== undefined) {
    const w = o.weekdays;
    if (!Array.isArray(w) || w.length === 0 || w.length > 7 || !w.every((d) => isInt(d) && d >= 0 && d <= 6) || new Set(w).size !== w.length) {
      return { ok: false, error: "Pick one or more different weekdays." };
    }
    rules.weekdays = [...(w as number[])].sort((a, b) => a - b);
  }
  if (o.window !== undefined) {
    const w = o.window as Record<string, unknown> | null;
    if (!w || typeof w !== "object" || Object.keys(w).some((k) => k !== "startMin" && k !== "endMin")) return { ok: false, error: "Invalid time window." };
    if (!isInt(w.startMin) || !isInt(w.endMin) || w.startMin < 0 || w.endMin > 1440 || w.startMin >= w.endMin) return { ok: false, error: "The time window must start before it ends." };
    if (w.endMin - w.startMin < 30) return { ok: false, error: "The time window must be at least 30 minutes long." };
    rules.window = { startMin: w.startMin, endMin: w.endMin };
  }
  if (o.dip !== undefined) {
    const d = o.dip as Record<string, unknown> | null;
    if (!d || typeof d !== "object" || Object.keys(d).some((k) => k !== "refDays" && k !== "minDropPct")) return { ok: false, error: "Invalid dip rule." };
    if (!isRef(d.refDays) || typeof d.minDropPct !== "number" || !Number.isFinite(d.minDropPct) || d.minDropPct < 1 || d.minDropPct > 50) {
      return { ok: false, error: "A dip rule needs 7 or 30 days and a drop between 1% and 50%." };
    }
    rules.dip = { refDays: d.refDays, minDropPct: Math.round(d.minDropPct * 100) / 100 };
  }
  if (o.skipIfUp !== undefined) {
    const s = o.skipIfUp as Record<string, unknown> | null;
    if (!s || typeof s !== "object" || Object.keys(s).some((k) => k !== "days" && k !== "pct")) return { ok: false, error: "Invalid skip rule." };
    if (!isRef(s.days) || typeof s.pct !== "number" || !Number.isFinite(s.pct) || s.pct < 1 || s.pct > 100) {
      return { ok: false, error: "A skip rule needs 7 or 30 days and a rise between 1% and 100%." };
    }
    rules.skipIfUp = { days: s.days, pct: Math.round(s.pct * 100) / 100 };
  }
  if (!rules.weekdays && !rules.window && !rules.dip && !rules.skipIfUp) return { ok: false, error: "Add at least one rule." };
  if (canonicalRules(rules).length > MAX_RULES_JSON) return { ok: false, error: "Rules are too long." };
  return { ok: true, rules };
}

/** Same bytes everywhere: fixed key order, no spaces. This exact text is what the owner signs. */
export function canonicalRules(r: PlanRules): string {
  const parts: string[] = ['"v":1'];
  if (r.weekdays) parts.push(`"weekdays":[${r.weekdays.join(",")}]`);
  if (r.window) parts.push(`"window":{"startMin":${r.window.startMin},"endMin":${r.window.endMin}}`);
  if (r.dip) parts.push(`"dip":{"refDays":${r.dip.refDays},"minDropPct":${r.dip.minDropPct}}`);
  if (r.skipIfUp) parts.push(`"skipIfUp":{"days":${r.skipIfUp.days},"pct":${r.skipIfUp.pct}}`);
  return `{${parts.join(",")}}`;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Plain-English summary shown to the user and included in the signed message. */
export function describeRules(r: PlanRules): string {
  const out: string[] = [];
  if (r.weekdays) out.push(`only on ${r.weekdays.map((d) => DAY_NAMES[d]).join(", ")}`);
  if (r.window) out.push(`only between ${hhmm(r.window.startMin)} and ${hhmm(r.window.endMin)} US Eastern`);
  if (r.dip) out.push(`only when the price is at least ${r.dip.minDropPct}% below its ${r.dip.refDays}-day high`);
  if (r.skipIfUp) out.push(`skip when the price is up more than ${r.skipIfUp.pct}% over ${r.skipIfUp.days} days`);
  return out.join("; ");
}

export function easternParts(now: Date): { weekday: number; minutes: number } {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" });
  const parts = f.formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { weekday: DAY_NAMES.indexOf(wd), minutes: h * 60 + m };
}

/** Decide whether a due run may go ahead. Any rule that cannot be checked makes the run wait (fail closed). */
export function evaluateRules(rules: PlanRules, ctx: RuleContext): Decision {
  const { weekday, minutes } = easternParts(ctx.now);
  if (rules.weekdays && !rules.weekdays.includes(weekday)) return { run: false, reason: `not one of the chosen weekdays (today is ${DAY_NAMES[weekday]} in US Eastern)` };
  if (rules.window && (minutes < rules.window.startMin || minutes >= rules.window.endMin)) return { run: false, reason: "outside the chosen time window" };

  if (rules.dip || rules.skipIfUp) {
    if (!Number.isFinite(ctx.price) || ctx.price <= 0) return { run: false, reason: "no current price to check the rule against" };
    const nowSec = Math.floor(ctx.now.getTime() / 1000);
    const hist = ctx.history.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c) && p.c > 0 && p.t <= nowSec + DAY).sort((a, b) => a.t - b.t);

    if (rules.dip) {
      const since = nowSec - rules.dip.refDays * DAY;
      const recent = hist.filter((p) => p.t >= since);
      if (recent.length < 2) return { run: false, reason: "not enough price history to check the dip rule" };
      const high = Math.max(ctx.price, ...recent.map((p) => p.c));
      const dropPct = (1 - ctx.price / high) * 100;
      if (dropPct < rules.dip.minDropPct) return { run: false, reason: `price is only ${dropPct.toFixed(1)}% below its ${rules.dip.refDays}-day high, the rule needs ${rules.dip.minDropPct}%` };
    }
    if (rules.skipIfUp) {
      const cutoff = nowSec - rules.skipIfUp.days * DAY;
      let ref: PricePoint | null = null;
      for (const p of hist) {
        if (p.t <= cutoff) ref = p;
        else break;
      }
      if (!ref) return { run: false, reason: "not enough price history to check the skip rule" };
      const upPct = (ctx.price / ref.c - 1) * 100;
      if (upPct > rules.skipIfUp.pct) return { run: false, reason: `price is up ${upPct.toFixed(1)}% over ${rules.skipIfUp.days} days, above the ${rules.skipIfUp.pct}% limit` };
    }
  }
  return { run: true };
}

/** The exact text the plan owner signs. The server and the keeper rebuild it from the stored fields. */
export function rulesMessage(a: { chainId: number; orderBook: string; planId: string; rules: PlanRules | null; issuedAt: number }): string {
  const body = a.rules ? `${describeRules(a.rules)}\nRules: ${canonicalRules(a.rules)}` : "Remove all rules (the plan runs on its schedule only)\nRules: none";
  return [
    "Base Analytics plan rules",
    "These rules can only delay a run of your recurring buy. They cannot change amounts, fees or where funds go.",
    `Chain: ${a.chainId}`,
    `Order book: ${a.orderBook.toLowerCase()}`,
    `Plan: ${a.planId}`,
    body,
    `Issued: ${a.issuedAt}`,
  ].join("\n");
}
