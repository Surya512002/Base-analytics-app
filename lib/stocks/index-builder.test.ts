import { describe, expect, it } from "vitest";
import { planRebalance, validateTargets } from "./portfolio-math";
import { cashKept, checkIndex, fitWeights, indexLegs, limitBreaches, parseRules, pickStocks, targetsFromIndex } from "./index-builder";

const total = (w: Record<string, number>) => Math.round(Object.values(w).reduce((s, n) => s + n, 0) * 100) / 100;
const rules = { maxPct: 25, cashPct: 10 };
const equal = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`S${i}`, 1]));

describe("fitWeights", () => {
  it("splits the invested part evenly and exactly", () => {
    const w = fitWeights(equal(7), rules);
    expect(total(w)).toBe(90);
    expect(Math.max(...Object.values(w)) - Math.min(...Object.values(w))).toBeLessThanOrEqual(0.011);
  });

  it("caps a big weight and passes the rest to the others", () => {
    const w = fitWeights({ A: 70, B: 10, C: 5, D: 5, E: 10 }, rules);
    expect(w.A).toBe(25);
    expect(total(w)).toBe(90);
    expect(w.B).toBeGreaterThan(w.C!);
    expect(Math.max(...Object.values(w))).toBeLessThanOrEqual(25);
  });

  it("leaves cash when the limit can't place everything", () => {
    expect(fitWeights(equal(2), rules)).toEqual({ S0: 25, S1: 25 });
  });

  it("splits evenly when it is given nothing to go by", () => {
    expect(fitWeights({ A: 0, B: 0 }, { maxPct: 100, cashPct: 0 })).toEqual({ A: 50, B: 50 });
  });
});

describe("buy amounts", () => {
  it("never spends more than the total, and keeps the reserve", () => {
    const legs = indexLegs(fitWeights(equal(7), rules), 100);
    const spent = legs.reduce((s, l) => s + Number(l.amount), 0);
    expect(spent).toBeLessThanOrEqual(90);
    expect(cashKept(legs, 100)).toBeCloseTo(100 - spent, 2);
    expect(cashKept(legs, 100)).toBeGreaterThanOrEqual(10);
  });
});

describe("checkIndex", () => {
  const good = fitWeights(equal(5), rules);
  const ids = (p: Partial<Parameters<typeof checkIndex>[0]>) => checkIndex({ weights: good, rules, totalUsd: 100, ...p }).map((i) => i.id);

  it("passes a usable index", () => {
    expect(ids({})).toEqual([]);
  });

  it("names the unavailable stock and the breached limit", () => {
    const issues = checkIndex({ weights: { A: 40, B: 25, C: 25 }, rules, totalUsd: 100, unavailable: ["C"] });
    expect(issues.map((i) => i.id)).toEqual(["limit-A", "unavailable-C"]);
    expect(issues.every((i) => i.level === "block")).toBe(true);
    expect(issues[0]!.text).toBe("A is 40%, above your 25% limit.");
  });

  it("protects the cash reserve", () => {
    expect(ids({ weights: { A: 25, B: 25, C: 25, D: 25 } })).toEqual(["cash"]);
  });

  it("refuses empty, tiny and underfunded indexes", () => {
    expect(ids({ weights: {} })).toContain("too-few");
    expect(ids({ weights: { A: 0.5, B: 25 } })).toContain("small-A");
    expect(ids({ totalUsd: 4 })).toContain("amount");
    expect(ids({ totalUsd: Number.NaN })).toContain("amount");
  });

  it("only notes extra cash", () => {
    expect(checkIndex({ weights: { A: 25, B: 25 }, rules, totalUsd: 100 })).toMatchObject([{ id: "extra-cash", level: "note" }]);
  });
});

describe("after buying", () => {
  const targets = targetsFromIndex({ A: 25, B: 25, C: 25, D: 15 });

  it("hands Holdings a mix it accepts", () => {
    expect(validateTargets(targets)).toBeNull();
  });

  it("reports a holding that outgrew the limit, and rebalances it even inside the drift band", () => {
    // A is 29.7% of the stocks, 26.7% of an index that keeps 10% cash: above 25, but under 3 points off target.
    const held = [{ symbol: "A", valueUsd: 297 }, { symbol: "B", valueUsd: 270 }, { symbol: "C", valueUsd: 270 }, { symbol: "D", valueUsd: 163 }];
    expect(limitBreaches(held, targets, rules).map((b) => b.symbol)).toEqual(["A"]);
    expect(planRebalance(held, targets).balanced).toBe(true);
    expect(planRebalance(held, targets, { force: ["A"] }).sells.map((s) => s.symbol)).toEqual(["A"]);
  });
});

describe("helpers", () => {
  it("leaves out what the owner excluded and stops at ten", () => {
    const pool = Array.from({ length: 15 }, (_, i) => `S${i}`);
    const picked = pickStocks(pool, new Set(["S0"]));
    expect(picked).toHaveLength(10);
    expect(picked[0]).toBe("S1");
  });

  it("ignores saved rules that make no sense", () => {
    expect(parseRules('{"maxPct":25,"cashPct":10}')).toEqual(rules);
    expect(parseRules('{"maxPct":500,"cashPct":10}')).toBeNull();
    expect(parseRules("not json")).toBeNull();
    expect(parseRules(null)).toBeNull();
  });
});
