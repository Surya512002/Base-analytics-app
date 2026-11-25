import { describe, expect, it } from "vitest";
import { chartToOrderPrice, gapPct, moveUsd, orderToTerminalPrice, priceAtPct, rewardToRisk } from "@/src/lib/limitOrders/priceBasis";

describe("gapPct", () => {
  it("is positive when Chainlink is above the DEX price", () => {
    expect(gapPct(102, 100)).toBeCloseTo(2, 6);
    expect(gapPct(98, 100)).toBeCloseTo(-2, 6);
  });
  it("is null for missing, zero, negative or non-finite prices", () => {
    expect(gapPct(null, 100)).toBeNull();
    expect(gapPct(100, undefined)).toBeNull();
    expect(gapPct(0, 100)).toBeNull();
    expect(gapPct(100, -1)).toBeNull();
    expect(gapPct(Number.NaN, 100)).toBeNull();
    expect(gapPct(Infinity, 100)).toBeNull();
  });
});

describe("chartToOrderPrice", () => {
  it("moves a chart price onto the Chainlink basis by the current gap", () => {
    const r = chartToOrderPrice(210, 204, 200)!; // Chainlink is 2% above the DEX
    expect(r.price).toBeCloseTo(214.2, 6);
    expect(r.gapPct).toBeCloseTo(2, 6);
    expect(r.suspect).toBe(false);
  });
  it("round-trips with orderToTerminalPrice", () => {
    const o = chartToOrderPrice(123.45, 207.3, 201.1)!.price;
    expect(orderToTerminalPrice(o, 207.3, 201.1)).toBeCloseTo(123.45, 8);
  });
  it("flags a huge gap as suspect instead of hiding it", () => {
    expect(chartToOrderPrice(100, 130, 100)!.suspect).toBe(true);
  });
  it("returns null without a usable pair or a usable chart price", () => {
    expect(chartToOrderPrice(100, null, 100)).toBeNull();
    expect(chartToOrderPrice(0, 100, 100)).toBeNull();
    expect(chartToOrderPrice(Number.NaN, 100, 100)).toBeNull();
    expect(orderToTerminalPrice(100, null, 100)).toBeNull();
  });
});

describe("priceAtPct / moveUsd / rewardToRisk", () => {
  it("prices a percent away", () => {
    expect(priceAtPct(200, -5)).toBeCloseTo(190, 8);
    expect(priceAtPct(200, 10)).toBeCloseTo(220, 8);
    expect(priceAtPct(null, 5)).toBeNull();
    expect(priceAtPct(200, -100)).toBeNull();
  });
  it("computes what a stop would lose and a target would make", () => {
    const down = moveUsd(1000, 200, 190)!;
    expect(down.usd).toBeCloseTo(-50, 8);
    expect(down.pct).toBeCloseTo(-5, 8);
    const up = moveUsd(1000, 200, 230)!;
    expect(up.usd).toBeCloseTo(150, 8);
    expect(moveUsd(0, 200, 190)).toBeNull();
    expect(moveUsd(1000, 0, 190)).toBeNull();
  });
  it("reward to risk needs a target above and a stop below the entry", () => {
    expect(rewardToRisk(100, 110, 95)).toBeCloseTo(2, 8);
    expect(rewardToRisk(100, 90, 95)).toBeNull();
    expect(rewardToRisk(100, 110, 105)).toBeNull();
    expect(rewardToRisk(0, 110, 95)).toBeNull();
  });
});
