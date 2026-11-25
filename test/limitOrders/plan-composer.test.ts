import { describe, expect, it } from "vitest";
import { PLAN_PRESETS, ceilingBelow, ceilingFromPct, composeBasketPlan, equalWeights, keeperFeeUsd, normalizeWeights, validateWeights, type ComposerStock } from "@/src/lib/limitOrders/planComposer";

const usdc = (n: number) => BigInt(Math.round(n * 1e6));
const tok = (i: number) => `0x${String(i).padStart(40, "0")}` as `0x${string}`;
const stock = (i: number, weightPct: number, cap = 250): ComposerStock => ({ symbol: `S${i}`, stockToken: tok(i), weightPct, maxQuoteIn: usdc(cap) });

describe("weights", () => {
  it("equal weights always add up to exactly 100", () => {
    for (const n of [1, 2, 3, 6, 7, 9, 10]) {
      const w = equalWeights(n);
      expect(w.reduce((s, x) => s + Math.round(x * 100), 0)).toBe(10_000);
      expect(validateWeights(w)).toBeNull();
    }
  });
  it("rejects bad sets", () => {
    expect(validateWeights([])).toMatch(/at least one/);
    expect(validateWeights(Array(11).fill(9))).toMatch(/at most 10/);
    expect(validateWeights([60, 30])).toMatch(/100%/);
    expect(validateWeights([99.5, 0.5])).toMatch(/at least 1%/);
    expect(validateWeights([Number.NaN, 50])).toMatch(/at least 1%/);
  });
});

describe("normalizeWeights", () => {
  it("scales to exactly 100 and keeps the order of size", () => {
    const w = normalizeWeights([50, 30, 10]);
    expect(w.reduce((s, x) => s + Math.round(x * 100), 0)).toBe(10_000);
    expect(w[0]).toBeGreaterThan(w[1]);
    expect(w[1]).toBeGreaterThan(w[2]);
  });
  it("handles awkward sets and bad input", () => {
    expect(normalizeWeights([1, 1, 1]).reduce((s, x) => s + Math.round(x * 100), 0)).toBe(10_000);
    expect(normalizeWeights([Number.NaN, 0, -3]).length).toBe(3);
    expect(normalizeWeights([0, 0]).reduce((s, x) => s + Math.round(x * 100), 0)).toBe(10_000);
    expect(normalizeWeights([])).toEqual([]);
  });
});

describe("composeBasketPlan", () => {
  const base = { buys: 10, intervalSec: 604_800, balance: usdc(10_000) };

  it("splits the budget by weight and never commits more than the budget", () => {
    const r = composeBasketPlan({ ...base, stocks: [stock(1, 50), stock(2, 30), stock(3, 20)], budget: usdc(100) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.legs.map((l) => l.amountPerBuy)).toEqual([usdc(5), usdc(3), usdc(2)]);
    expect(r.plan.totalCommitted).toBe(usdc(100));
    expect(r.plan.unspent).toBe(0n);
    expect(r.plan.durationSec).toBe(9 * 604_800);
  });

  it("rounds down to whole buys and leaves the dust in the wallet", () => {
    const r = composeBasketPlan({ ...base, stocks: [stock(1, 50), stock(2, 50)], budget: usdc(100.07), buys: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.totalCommitted + r.plan.unspent).toBe(usdc(100.07));
    expect(r.plan.totalCommitted).toBeLessThanOrEqual(usdc(100.07));
    for (const l of r.plan.legs) expect(l.total).toBe(l.amountPerBuy * 3n);
  });

  it("refuses a buy under $1 and names the stock", () => {
    const r = composeBasketPlan({ ...base, stocks: [stock(1, 99), stock(2, 1)], budget: usdc(100), buys: 52 });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/S2.*under \$1/) });
  });

  it("refuses a plan above the per-plan cap and says the cap", () => {
    const r = composeBasketPlan({ ...base, stocks: [stock(1, 100, 50)], budget: usdc(100) });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/\$50 per-plan limit/) });
  });

  it("refuses when the wallet cannot pay", () => {
    const r = composeBasketPlan({ ...base, balance: usdc(10), stocks: [stock(1, 50), stock(2, 50)], budget: usdc(100) });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/more USDC/) });
  });

  it("validates buys, interval, duplicates and budget", () => {
    const s = [stock(1, 50), stock(2, 50)];
    expect(composeBasketPlan({ ...base, stocks: s, budget: 0n }).ok).toBe(false);
    expect(composeBasketPlan({ ...base, stocks: s, budget: usdc(100), buys: 0 }).ok).toBe(false);
    expect(composeBasketPlan({ ...base, stocks: s, budget: usdc(100), buys: 366 }).ok).toBe(false);
    expect(composeBasketPlan({ ...base, stocks: s, budget: usdc(100), buys: 1.5 }).ok).toBe(false);
    expect(composeBasketPlan({ ...base, stocks: s, budget: usdc(100), intervalSec: 3599 }).ok).toBe(false);
    expect(composeBasketPlan({ ...base, stocks: [stock(1, 50), stock(1, 50)], budget: usdc(100) }).ok).toBe(false);
  });

  it("warns, but allows, buys between $1 and $5", () => {
    const r = composeBasketPlan({ ...base, stocks: [stock(1, 50), stock(2, 50)], budget: usdc(60), buys: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.warnings.length).toBe(2);
  });
});

describe("ceiling and fee helpers", () => {
  it("ceiling is a percent over today's price in 8-decimal units", () => {
    expect(ceilingFromPct(20_000_000_000n, 10)).toBe(22_000_000_000n);
    expect(ceilingFromPct(20_000_000_000n, 0)).toBe(20_000_000_000n);
    expect(ceilingFromPct(null, 10)).toBeNull();
    expect(ceilingFromPct(0n, 10)).toBeNull();
    expect(ceilingFromPct(100n, -1)).toBeNull();
    expect(ceilingFromPct(100n, Number.NaN)).toBeNull();
  });
  it("keeper fee in dollars", () => {
    expect(keeperFeeUsd(usdc(1000), 10)).toBeCloseTo(1, 8);
  });
});

describe("dip buys", () => {
  const base = { buys: 4, intervalSec: 604_800, balance: usdc(10_000) };
  const two = [stock(1, 50), stock(2, 50)];

  it("splits each stock's share into a regular plan and a dip plan without spending more", () => {
    const r = composeBasketPlan({ ...base, stocks: two, budget: usdc(200), dip: { sharePct: 30, belowPct: 5 } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.legs.map((l) => l.key)).toEqual(["S1:regular", "S1:dip", "S2:regular", "S2:dip"]);
    expect(r.plan.legs.map((l) => l.total)).toEqual([usdc(70), usdc(30), usdc(70), usdc(30)]);
    expect(r.plan.totalCommitted).toBe(usdc(200));
    expect(new Set(r.plan.legs.map((l) => l.key)).size).toBe(4);
  });

  it("never commits more than the budget when amounts do not divide evenly", () => {
    const r = composeBasketPlan({ ...base, buys: 7, stocks: [stock(1, 33.34), stock(2, 33.33), stock(3, 33.33)], budget: usdc(100.01), dip: { sharePct: 37, belowPct: 3 } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.totalCommitted).toBeLessThanOrEqual(usdc(100.01));
      expect(r.plan.totalCommitted + r.plan.unspent).toBe(usdc(100.01));
    }
  });

  it("refuses a dip buy under $1 and says it is the dip buy", () => {
    const r = composeBasketPlan({ ...base, buys: 12, stocks: two, budget: usdc(40), dip: { sharePct: 10, belowPct: 5 } });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/S1: each dip buy would be under \$1/) });
  });

  it("applies the per-plan cap to each plan separately", () => {
    // $80 for one stock is over a $50 cap as one plan, but 50/50 gives two $40 plans
    expect(composeBasketPlan({ ...base, stocks: [stock(1, 100, 50)], budget: usdc(80) }).ok).toBe(false);
    expect(composeBasketPlan({ ...base, stocks: [stock(1, 100, 50)], budget: usdc(80), dip: { sharePct: 50, belowPct: 5 } }).ok).toBe(true);
  });

  it("refuses silly dip settings", () => {
    for (const dip of [{ sharePct: 5, belowPct: 5 }, { sharePct: 95, belowPct: 5 }, { sharePct: 30, belowPct: 0 }, { sharePct: 30, belowPct: 60 }, { sharePct: Number.NaN, belowPct: 5 }]) {
      expect(composeBasketPlan({ ...base, stocks: two, budget: usdc(200), dip }).ok).toBe(false);
    }
  });

  it("warns once per stock about small buys", () => {
    const r = composeBasketPlan({ ...base, stocks: two, budget: usdc(32), dip: { sharePct: 50, belowPct: 5 } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.warnings).toHaveLength(2);
  });

  it("the dip ceiling sits below today's price", () => {
    expect(ceilingBelow(20_000_000_000n, 5)).toBe(19_000_000_000n);
    expect(ceilingBelow(null, 5)).toBeNull();
    expect(ceilingBelow(20_000_000_000n, 0)).toBeNull();
    expect(ceilingBelow(20_000_000_000n, 100)).toBeNull();
    expect(ceilingBelow(1n, 50)).toBeNull();
  });
});

describe("ready-made plans", () => {
  it("every preset produces a plan the maths accepts", () => {
    expect(new Set(PLAN_PRESETS.map((p) => p.id)).size).toBe(PLAN_PRESETS.length);
    for (const p of PLAN_PRESETS) {
      const r = composeBasketPlan({ stocks: [stock(1, 50), stock(2, 50)], budget: usdc(200), buys: p.buys, intervalSec: p.intervalSec, balance: usdc(1000), dip: p.dip });
      expect(r.ok, p.id).toBe(true);
    }
  });
});
