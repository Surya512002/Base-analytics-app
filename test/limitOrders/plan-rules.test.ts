import { describe, expect, it } from "vitest";
import {
  canonicalRules,
  describeRules,
  easternParts,
  evaluateRules,
  rulesMessage,
  validateRules,
  type PlanRules,
  type PricePoint,
} from "@/limit-orders/shared/planRules";

const DAY = 86_400;
const at = (iso: string) => new Date(iso);
// Tuesday 24 Nov 2026, 15:00 UTC = 10:00 US Eastern (winter time, UTC-5)
const TUE_10AM_ET = at("2026-11-24T15:00:00Z");

/** Daily closes ending the day before `now`, price(i) for i days ago. */
function hist(now: Date, days: number, price: (daysAgo: number) => number): PricePoint[] {
  const nowSec = Math.floor(now.getTime() / 1000);
  return Array.from({ length: days }, (_, i) => ({ t: nowSec - (i + 1) * DAY, c: price(i + 1) }));
}

describe("validateRules", () => {
  it("accepts a full set and normalises it", () => {
    const r = validateRules({ v: 1, weekdays: [3, 1], window: { startMin: 570, endMin: 630 }, dip: { refDays: 7, minDropPct: 5 }, skipIfUp: { days: 30, pct: 20 } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rules.weekdays).toEqual([1, 3]);
  });

  it.each([
    [null],
    ["x"],
    [[]],
    [{}],
    [{ v: 2, weekdays: [1] }],
    [{ v: 1 }],
    [{ v: 1, weekdays: [] }],
    [{ v: 1, weekdays: [7] }],
    [{ v: 1, weekdays: [1, 1] }],
    [{ v: 1, weekdays: [1.5] }],
    [{ v: 1, weekdays: "1" }],
    [{ v: 1, window: { startMin: 600, endMin: 600 } }],
    [{ v: 1, window: { startMin: 600, endMin: 620 } }],
    [{ v: 1, window: { startMin: -1, endMin: 700 } }],
    [{ v: 1, window: { startMin: 0, endMin: 1441 } }],
    [{ v: 1, window: { startMin: 0, endMin: 600, extra: 1 } }],
    [{ v: 1, dip: { refDays: 14, minDropPct: 5 } }],
    [{ v: 1, dip: { refDays: 7, minDropPct: 0 } }],
    [{ v: 1, dip: { refDays: 7, minDropPct: 51 } }],
    [{ v: 1, dip: { refDays: 7, minDropPct: Number.NaN } }],
    [{ v: 1, skipIfUp: { days: 7, pct: 101 } }],
    [{ v: 1, skipIfUp: { days: 30, pct: Infinity } }],
    [{ v: 1, weekdays: [1], sneaky: true }],
  ])("refuses %j", (input) => {
    expect(validateRules(input).ok).toBe(false);
  });

  it("refuses a __proto__ key smuggled in through JSON", () => {
    expect(validateRules(JSON.parse('{"v":1,"weekdays":[1],"__proto__":{"admin":true}}')).ok).toBe(false);
  });
});

describe("canonical text and message", () => {
  it("is identical whatever order the input keys came in", () => {
    const a = validateRules({ skipIfUp: { pct: 20, days: 7 }, dip: { minDropPct: 5, refDays: 30 }, weekdays: [2], v: 1 });
    const b = validateRules({ v: 1, weekdays: [2], dip: { refDays: 30, minDropPct: 5 }, skipIfUp: { days: 7, pct: 20 } });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(canonicalRules(a.rules)).toBe(canonicalRules(b.rules));
  });

  it("the signed message names the chain, book, plan and rules in plain words", () => {
    const rules: PlanRules = { v: 1, weekdays: [2], window: { startMin: 570, endMin: 630 } };
    const m = rulesMessage({ chainId: 8453, orderBook: "0x080D52b060A467aE63d7d2cC7178dc6B1A3DB29D", planId: "12", rules, issuedAt: 1_700_000_000 });
    expect(m).toContain("Chain: 8453");
    expect(m).toContain("Order book: 0x080d52b060a467ae63d7d2cc7178dc6b1a3db29d");
    expect(m).toContain("Plan: 12");
    expect(m).toContain("only on Tue");
    expect(m).toContain("09:30 and 10:30 US Eastern");
    expect(m).toContain('Rules: {"v":1,"weekdays":[2],"window":{"startMin":570,"endMin":630}}');
    expect(m).toContain("cannot change amounts");
  });

  it("a removal message is different from any rules message", () => {
    const rem = rulesMessage({ chainId: 1, orderBook: "0xabc", planId: "1", rules: null, issuedAt: 5 });
    expect(rem).toContain("Rules: none");
  });

  it("describes every rule", () => {
    expect(describeRules({ v: 1, dip: { refDays: 7, minDropPct: 5 }, skipIfUp: { days: 30, pct: 15 } })).toBe(
      "only when the price is at least 5% below its 7-day high; skip when the price is up more than 15% over 30 days"
    );
  });
});

describe("US Eastern clock", () => {
  it("handles winter and summer time", () => {
    expect(easternParts(TUE_10AM_ET)).toEqual({ weekday: 2, minutes: 600 });
    expect(easternParts(at("2026-07-14T13:30:00Z"))).toEqual({ weekday: 2, minutes: 570 }); // 09:30 EDT
  });
  it("rolls the weekday back after midnight UTC but before midnight Eastern", () => {
    expect(easternParts(at("2026-11-25T03:00:00Z"))).toEqual({ weekday: 2, minutes: 22 * 60 }); // still Tuesday 22:00 ET
  });
  it("switches on the day clocks change (2026-11-01 is the end of summer time)", () => {
    expect(easternParts(at("2026-11-01T05:30:00Z")).minutes).toBe(1 * 60 + 30); // 01:30 EDT, before the change
    expect(easternParts(at("2026-11-01T07:30:00Z")).minutes).toBe(2 * 60 + 30); // 02:30 EST, after
  });
});

describe("evaluateRules: time rules", () => {
  const price = 100;
  it("weekday rule", () => {
    const r: PlanRules = { v: 1, weekdays: [2] };
    expect(evaluateRules(r, { now: TUE_10AM_ET, price, history: [] })).toEqual({ run: true });
    const wed = evaluateRules(r, { now: at("2026-11-25T15:00:00Z"), price, history: [] });
    expect(wed.run).toBe(false);
    if (!wed.run) expect(wed.reason).toMatch(/Wed/);
  });
  it("window start is inclusive and end is exclusive", () => {
    const r: PlanRules = { v: 1, window: { startMin: 570, endMin: 630 } };
    expect(evaluateRules(r, { now: at("2026-11-24T14:29:00Z"), price, history: [] }).run).toBe(false); // 09:29
    expect(evaluateRules(r, { now: at("2026-11-24T14:30:00Z"), price, history: [] }).run).toBe(true); // 09:30
    expect(evaluateRules(r, { now: at("2026-11-24T15:29:00Z"), price, history: [] }).run).toBe(true); // 10:29
    expect(evaluateRules(r, { now: at("2026-11-24T15:30:00Z"), price, history: [] }).run).toBe(false); // 10:30
  });
  it("opening hour stays 09:30 Eastern in summer too", () => {
    const r: PlanRules = { v: 1, window: { startMin: 570, endMin: 630 } };
    expect(evaluateRules(r, { now: at("2026-07-14T13:30:00Z"), price, history: [] }).run).toBe(true);
    expect(evaluateRules(r, { now: at("2026-07-14T14:30:00Z"), price, history: [] }).run).toBe(false);
  });
  it("all rules must pass together", () => {
    const r: PlanRules = { v: 1, weekdays: [2], window: { startMin: 570, endMin: 630 } };
    expect(evaluateRules(r, { now: at("2026-11-24T14:45:00Z"), price, history: [] }).run).toBe(true);
    expect(evaluateRules(r, { now: at("2026-11-25T14:45:00Z"), price, history: [] }).run).toBe(false);
  });
});

describe("evaluateRules: price rules", () => {
  const now = TUE_10AM_ET;
  const flat = hist(now, 40, () => 100);

  it("dip rule waits until the price is far enough below the recent high", () => {
    const r: PlanRules = { v: 1, dip: { refDays: 7, minDropPct: 5 } };
    expect(evaluateRules(r, { now, price: 99, history: flat }).run).toBe(false);
    expect(evaluateRules(r, { now, price: 94, history: flat }).run).toBe(true);
    const d = evaluateRules(r, { now, price: 97, history: flat });
    expect(d.run).toBe(false);
    if (!d.run) expect(d.reason).toMatch(/3\.0% below/);
  });
  it("the dip high only looks at the chosen window", () => {
    const old = hist(now, 40, (d) => (d > 10 ? 200 : 100)); // a 200 high 11+ days ago
    const r7: PlanRules = { v: 1, dip: { refDays: 7, minDropPct: 5 } };
    const r30: PlanRules = { v: 1, dip: { refDays: 30, minDropPct: 5 } };
    expect(evaluateRules(r7, { now, price: 99, history: old }).run).toBe(false);
    expect(evaluateRules(r30, { now, price: 99, history: old }).run).toBe(true);
  });
  it("a current price above the old high counts as the high", () => {
    const r: PlanRules = { v: 1, dip: { refDays: 7, minDropPct: 1 } };
    expect(evaluateRules(r, { now, price: 150, history: flat }).run).toBe(false);
  });
  it("skip-if-up waits after a big rise and runs after a calm week", () => {
    const r: PlanRules = { v: 1, skipIfUp: { days: 7, pct: 10 } };
    expect(evaluateRules(r, { now, price: 105, history: flat }).run).toBe(true);
    const rose = evaluateRules(r, { now, price: 115, history: flat });
    expect(rose.run).toBe(false);
    if (!rose.run) expect(rose.reason).toMatch(/up 15\.0%/);
  });
  it("fails closed without history, without a price, or with junk data", () => {
    const dip: PlanRules = { v: 1, dip: { refDays: 7, minDropPct: 5 } };
    const skip: PlanRules = { v: 1, skipIfUp: { days: 30, pct: 10 } };
    expect(evaluateRules(dip, { now, price: 90, history: [] }).run).toBe(false);
    expect(evaluateRules(skip, { now, price: 100, history: hist(now, 10, () => 100) }).run).toBe(false); // only 10 days of history
    expect(evaluateRules(dip, { now, price: Number.NaN, history: flat }).run).toBe(false);
    expect(evaluateRules(dip, { now, price: 0, history: flat }).run).toBe(false);
    const junk: PricePoint[] = [{ t: Number.NaN, c: 100 }, { t: 1, c: -5 }, { t: 2, c: 0 }];
    expect(evaluateRules(dip, { now, price: 90, history: junk }).run).toBe(false);
  });
  it("ignores future-dated candles", () => {
    const r: PlanRules = { v: 1, dip: { refDays: 7, minDropPct: 5 } };
    const nowSec = Math.floor(now.getTime() / 1000);
    const withFuture = [...flat, { t: nowSec + 10 * DAY, c: 1000 }];
    expect(evaluateRules(r, { now, price: 99, history: withFuture }).run).toBe(false);
  });
});
