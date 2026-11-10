import { describe, it, expect } from "vitest";
import {
  computeTradeSafety,
  IMPACT_THRESHOLDS,
} from "@/lib/markets/price-impact-service";

describe("Price Impact Safety Engine (computeTradeSafety)", () => {
  it("handles null and NaN impact values gracefully without throwing", () => {
    const nullResult = computeTradeSafety(null);
    expect(nullResult.tier).toBe("safe");
    expect(nullResult.action).toBe("allow");
    expect(nullResult.badgeLabel).toBe("Impact Unknown");

    const nanResult = computeTradeSafety(NaN);
    expect(nanResult.tier).toBe("safe");
    expect(nanResult.action).toBe("allow");
  });

  it("classifies sub-1% price impact as safe tier with allow action", () => {
    const resZero = computeTradeSafety(0);
    expect(resZero.tier).toBe("safe");
    expect(resZero.action).toBe("allow");
    expect(resZero.badgeLabel).toBe("< 1% Impact");

    const resPointFive = computeTradeSafety(0.5);
    expect(resPointFive.tier).toBe("safe");
    expect(resPointFive.action).toBe("allow");
    expect(resPointFive.badgeLabel).toBe("< 1% Impact");
    expect(resPointFive.suggestion).toBeNull();
  });

  it("classifies 1% to 5% impact as moderate tier with warning action", () => {
    const resModerate = computeTradeSafety(2.75);
    expect(resModerate.tier).toBe("moderate");
    expect(resModerate.action).toBe("warn");
    expect(resModerate.badgeLabel).toBe("2.75% Impact");
    expect(resModerate.message).toContain("2.75%");
    expect(resModerate.suggestion).toBeTruthy();

    const resEdge = computeTradeSafety(IMPACT_THRESHOLDS.MODERATE_MAX_PCT);
    expect(resEdge.tier).toBe("moderate");
    expect(resEdge.action).toBe("warn");
  });

  it("classifies 5% to 15% impact as high tier and suggests limit orders", () => {
    const resHigh = computeTradeSafety(8.5);
    expect(resHigh.tier).toBe("high");
    expect(resHigh.action).toBe("warn");
    expect(resHigh.badgeLabel).toBe("8.50% High Impact");
    expect(resHigh.suggestion).toContain("Limit Order");

    const resUpperHigh = computeTradeSafety(14.99);
    expect(resUpperHigh.tier).toBe("high");
    expect(resUpperHigh.action).toBe("warn");
  });

  it("classifies >15% impact as critical tier with block action and risk warning", () => {
    const resCritical = computeTradeSafety(25.4);
    expect(resCritical.tier).toBe("critical");
    expect(resCritical.action).toBe("block");
    expect(resCritical.badgeLabel).toBe("25.40% Critical Impact");
    expect(resCritical.message).toContain("loss in price impact");
    expect(resCritical.suggestion).toContain("Limit Order");

    const resExtreme = computeTradeSafety(80);
    expect(resExtreme.tier).toBe("critical");
    expect(resExtreme.action).toBe("block");
  });

  it("normalizes negative values to 0 safely", () => {
    const resNeg = computeTradeSafety(-3.5);
    expect(resNeg.impactPct).toBe(0);
    expect(resNeg.tier).toBe("safe");
  });
});
