import { describe, expect, it } from "vitest";
import { distancePct, movePrice, oracleHealth, sizeAdvice } from "@/lib/trade/safety";

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
