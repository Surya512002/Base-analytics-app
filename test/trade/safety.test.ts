import { describe, expect, it } from "vitest";
import { distancePct, formatDuration, movePrice, oracleHealth, ladderOffsets, planSchedule, sizeAdvice, splitEvenly } from "@/lib/trade/safety";
import { validateDcaSell } from "@/src/lib/limitOrders/orderMath";

describe("oracleHealth", () => {
  const limit = 3600;
  it("is fresh in the first half of the staleness window", () => {
    expect(oracleHealth(1000, limit, 1000 + 600).state).toBe("fresh");
  });
  it("is aging past half the window and stale past the limit", () => {
    expect(oracleHealth(1000, limit, 1000 + 2000).state).toBe("aging");
    const stale = oracleHealth(1000, limit, 1000 + 4000);
    expect(stale.state).toBe("stale");
    expect(stale.label).toMatch(/orders will wait/);
  });
  it("is unknown before the first read", () => {
    expect(oracleHealth(0, limit, 5000).state).toBe("unknown");
  });
});

describe("movePrice", () => {
  const p = 100_00000000n; // $100 at 8 decimals
  it("moves down and up by whole percents", () => {
    expect(movePrice(p, -5)).toBe(95_00000000n);
    expect(movePrice(p, 10)).toBe(110_00000000n);
  });
  it("supports fractional percents at bps precision", () => {
    expect(movePrice(p, 2.5)).toBe(102_50000000n);
  });
  it("never goes negative", () => {
    expect(movePrice(p, -150)).toBe(0n);
  });
});

describe("sizeAdvice", () => {
  it("is quiet for small orders", () => {
    expect(sizeAdvice(100, 1_000_000).level).toBe("ok");
  });
  it("warns above 1% and 2% of liquidity", () => {
    expect(sizeAdvice(15_000, 1_000_000).message).toMatch(/1\.5% of the pool/);
    expect(sizeAdvice(30_000, 1_000_000).message).toMatch(/may not fill/);
  });
  it("warns when liquidity is unknown", () => {
    expect(sizeAdvice(100, null).level).toBe("warn");
  });
  it("ignores empty orders", () => {
    expect(sizeAdvice(null, 5)).toEqual({ level: "ok", message: null });
  });
});

describe("distancePct", () => {
  it("returns signed percent distance", () => {
    expect(distancePct(100, 95)).toBeCloseTo(-5);
    expect(distancePct(100, 120)).toBeCloseTo(20);
    expect(distancePct(0, 5)).toBeNull();
  });
});

describe("planSchedule", () => {
  it("runs immediately and then every interval", () => {
    const s = planSchedule(1000, 4, 86_400);
    expect(s.runs).toEqual([1000, 87_400, 173_800, 260_200]);
    expect(s.lastRun).toBe(260_200);
    expect(s.durationSec).toBe(3 * 86_400);
  });
  it("handles a single run and zero runs", () => {
    expect(planSchedule(5, 1, 3600).durationSec).toBe(0);
    expect(planSchedule(5, 0, 3600).runs).toEqual([]);
  });
});

describe("formatDuration", () => {
  it("is human readable", () => {
    expect(formatDuration(0)).toBe("right away");
    expect(formatDuration(3 * 3600)).toBe("3 hours");
    expect(formatDuration(3 * 86_400)).toBe("3 days");
    expect(formatDuration(28 * 86_400)).toBe("4 weeks");
    expect(formatDuration(180 * 86_400)).toBe("6 months");
  });
});

describe("validateDcaSell", () => {
  const ok = { amountPerSell: 100n, sells: 4, intervalSec: 3600, minPrice: null, balance: 1000n, maxStockIn: 1000n };
  it("accepts a valid plan", () => {
    expect(validateDcaSell(ok)).toBeNull();
  });
  it("rejects bad inputs", () => {
    expect(validateDcaSell({ ...ok, amountPerSell: null })).toMatch(/amount/i);
    expect(validateDcaSell({ ...ok, sells: 0 })).toMatch(/between 1 and 365/);
    expect(validateDcaSell({ ...ok, intervalSec: 60 })).toMatch(/1 hour/);
    expect(validateDcaSell({ ...ok, balance: 399n })).toMatch(/balance/);
    expect(validateDcaSell({ ...ok, maxStockIn: 399n })).toMatch(/limit/);
  });
});

describe("ladder helpers", () => {
  it("spaces offsets evenly and inclusively", () => {
    expect(ladderOffsets(-2, -10, 5)).toEqual([-2, -4, -6, -8, -10]);
    expect(ladderOffsets(1, 5, 3)).toEqual([1, 3, 5]);
    expect(ladderOffsets(-5, -20, 1)).toEqual([-5]);
    expect(ladderOffsets(1, 2, 0)).toEqual([]);
  });
  it("splits amounts so the parts always sum to the total", () => {
    const parts = splitEvenly(1000n, 3);
    expect(parts).toEqual([334n, 333n, 333n]);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(1000n);
    expect(splitEvenly(0n, 3)).toEqual([]);
  });
});
