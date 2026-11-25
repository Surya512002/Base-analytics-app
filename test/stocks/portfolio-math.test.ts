import { describe, expect, it } from "vitest";
import { allocation, drift, equalTargets, mixReturnPct, planRebalance, validateTargets } from "@/lib/stocks/portfolio-math";

describe("targets", () => {
  it("equal split always adds up to exactly 100", () => {
    for (const n of [2, 3, 6, 7, 13, 20]) {
      const t = equalTargets(Array.from({ length: n }, (_, i) => `S${i}`));
      expect(Object.values(t).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
      expect(validateTargets(t)).toBeNull();
    }
  });

  it("rejects bad mixes", () => {
    expect(validateTargets({ A: 100 })).toMatch(/at least 2/);
    expect(validateTargets({ A: 60, B: 30 })).toMatch(/100%/);
    expect(validateTargets({ A: 99.5, B: 0.5 })).toMatch(/at least 1%/);
    expect(validateTargets({ A: Number.NaN, B: 50 })).toMatch(/at least 1%/);
    expect(validateTargets(equalTargets(Array.from({ length: 21 }, (_, i) => `S${i}`)))).toMatch(/at most 20/);
  });
});

describe("allocation and drift", () => {
  it("drops zero and bad values, merges duplicates, sorts by value", () => {
    const a = allocation([
      { symbol: "A", valueUsd: 30 },
      { symbol: "B", valueUsd: 0 },
      { symbol: "C", valueUsd: Number.NaN },
      { symbol: "A", valueUsd: 10 },
      { symbol: "D", valueUsd: 60 },
    ]);
    expect(a.map((r) => r.symbol)).toEqual(["D", "A"]);
    expect(a[0].weightPct).toBeCloseTo(60, 6);
    expect(allocation([])).toEqual([]);
  });

  it("measures drift against target stocks only (other holdings are ignored)", () => {
    const d = drift([{ symbol: "A", valueUsd: 80 }, { symbol: "B", valueUsd: 20 }, { symbol: "X", valueUsd: 1000 }], { A: 50, B: 50 });
    expect(d.totalUsd).toBe(100);
    expect(d.rows.find((r) => r.symbol === "A")!.driftPts).toBeCloseTo(30, 6);
    expect(d.rows.find((r) => r.symbol === "B")!.driftPts).toBeCloseTo(-30, 6);
  });
});

describe("planRebalance", () => {
  const targets = { A: 50, B: 50 };

  it("sells the overweight stock and buys the underweight one for the same amount", () => {
    const p = planRebalance([{ symbol: "A", valueUsd: 80 }, { symbol: "B", valueUsd: 20 }], targets);
    expect(p.sells).toEqual([{ symbol: "A", usd: 30 }]);
    expect(p.buys).toEqual([{ symbol: "B", usd: 30 }]);
    expect(p.balanced).toBe(false);
  });

  it("does nothing inside the band", () => {
    const p = planRebalance([{ symbol: "A", valueUsd: 52 }, { symbol: "B", valueUsd: 48 }], targets);
    expect(p.balanced).toBe(true);
    expect(p.sells).toHaveLength(0);
    expect(p.buys).toHaveLength(0);
  });

  it("never plans to buy more than the sells plus cash can pay", () => {
    const p = planRebalance([{ symbol: "A", valueUsd: 60 }, { symbol: "B", valueUsd: 20 }, { symbol: "C", valueUsd: 20 }], { A: 20, B: 40, C: 40 });
    const paid = p.sells.reduce((s, l) => s + l.usd, 0);
    const spent = p.buys.reduce((s, l) => s + l.usd, 0);
    expect(spent).toBeLessThanOrEqual(paid + 0.01);
  });

  it("with extra cash and nothing to sell, spends the cash on the underweight stocks only", () => {
    const p = planRebalance([{ symbol: "A", valueUsd: 50 }, { symbol: "B", valueUsd: 10 }], targets, { extraCashUsd: 40 });
    expect(p.sells).toHaveLength(0);
    expect(p.buys).toEqual([{ symbol: "B", usd: 40 }]);
    expect(p.buys.reduce((s, l) => s + l.usd, 0)).toBeLessThanOrEqual(40);
  });

  it("buys a stock that is in the target but not held yet", () => {
    const p = planRebalance([{ symbol: "A", valueUsd: 100 }], targets);
    expect(p.sells).toEqual([{ symbol: "A", usd: 50 }]);
    expect(p.buys).toEqual([{ symbol: "B", usd: 50 }]);
  });

  it("returns an empty, balanced plan with no holdings and no cash, and ignores junk cash", () => {
    expect(planRebalance([], targets).balanced).toBe(true);
    expect(planRebalance([], targets, { extraCashUsd: Number.NaN }).balanced).toBe(true);
    expect(planRebalance([], targets, { extraCashUsd: -5 }).balanced).toBe(true);
  });

  it("skips trades below the minimum size", () => {
    const p = planRebalance([{ symbol: "A", valueUsd: 5.5 }, { symbol: "B", valueUsd: 0.5 }], targets, { bandPts: 1, minTradeUsd: 5 });
    expect(p.balanced).toBe(true);
  });

  it("never sells more than is held", () => {
    const p = planRebalance([{ symbol: "A", valueUsd: 10 }, { symbol: "B", valueUsd: 0 }], { A: 1, B: 99 });
    expect(p.sells.every((s) => s.usd <= 10)).toBe(true);
  });
});

describe("mixReturnPct", () => {
  it("weights each stock's return by its share and skips stocks without data", () => {
    const r = mixReturnPct({ A: 50, B: 30, C: 20 }, { A: 10, B: -10, C: null });
    expect(r.returnPct).toBeCloseTo((50 * 10 + 30 * -10) / 80, 6);
    expect(r.covered).toBe(80);
  });
  it("returns null when nothing has data", () => {
    expect(mixReturnPct({ A: 100 }, {}).returnPct).toBeNull();
  });
});
