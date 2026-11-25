import { describe, expect, it } from "vitest";
import { belowFloor, fairFloor, floorFor, rememberQuote } from "@/lib/swap/price-guard";

describe("belowFloor", () => {
  it("refuses a quote under the floor and allows one at or above it", () => {
    expect(belowFloor("999", 1000n)).toBe(true);
    expect(belowFloor("1000", 1000n)).toBe(false);
    expect(belowFloor("1001", 1000n)).toBe(false);
  });
  it("treats an unreadable quote as below the floor", () => {
    for (const bad of [undefined, null, "", "abc", "1.5", "-5"]) expect(belowFloor(bad, 1n)).toBe(true);
  });
});

describe("remembered quote", () => {
  it("only applies to exactly the request it was shown for", () => {
    const q = rememberQuote("AAPL|buy|10|1", "5000");
    expect(floorFor(q, "AAPL|buy|10|1")).toBe(5000n);
    expect(floorFor(q, "AAPL|buy|5|1")).toBeUndefined(); // amount changed before the new quote arrived
    expect(floorFor(null, "AAPL|buy|10|1")).toBeUndefined();
  });
  it("ignores missing or zero minimums", () => {
    expect(rememberQuote("k", null)).toBeNull();
    expect(rememberQuote("k", "0")).toBeNull();
    expect(rememberQuote("k", "x")).toBeNull();
  });
});

describe("fairFloor", () => {
  it("sell: tokens x price in USDC, less the allowed shortfall", () => {
    // 0.5 tokens at $200 = $100, floor 95 USDC
    expect(fairFloor({ side: "sell", amountIn: 0.5, priceUsd: 200, outDecimals: 6 })).toBe(95_000_000n);
  });
  it("buy: USDC / price in tokens, less the allowed shortfall", () => {
    // $100 at $200 = 0.5 tokens, floor 0.475 with 8 decimals
    expect(fairFloor({ side: "buy", amountIn: 100, priceUsd: 200, outDecimals: 8 })).toBe(47_500_000n);
  });
  it("keeps precision for 18-decimal tokens", () => {
    expect(fairFloor({ side: "buy", amountIn: 100, priceUsd: 100, outDecimals: 18, maxShortfallPct: 0 })).toBe(10n ** 18n);
  });
  it("catches a badly priced route that slippage alone would accept", () => {
    const floor = fairFloor({ side: "sell", amountIn: 1, priceUsd: 100, outDecimals: 6 })!;
    expect(belowFloor("80000000", floor)).toBe(true); // route offers $80 for a $100 token
    expect(belowFloor("99500000", floor)).toBe(false);
  });
  it("gives no floor without a usable price or amount", () => {
    for (const bad of [null, undefined, 0, -1, Number.NaN, Infinity]) {
      expect(fairFloor({ side: "sell", amountIn: 1, priceUsd: bad as number, outDecimals: 6 })).toBeNull();
    }
    expect(fairFloor({ side: "sell", amountIn: 0, priceUsd: 10, outDecimals: 6 })).toBeNull();
    expect(fairFloor({ side: "sell", amountIn: 1, priceUsd: 10, outDecimals: 99 })).toBeNull();
    expect(fairFloor({ side: "sell", amountIn: 1e-12, priceUsd: 1e-12, outDecimals: 6 })).toBeNull();
  });
});
