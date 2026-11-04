import { describe, it, expect } from "vitest";
import {
  getEquityMarketStatus,
  computeNavSpread,
} from "@/lib/stocks/nav-tracker";

describe("Stock NAV Tracker Math & Market Hours", () => {
  it("detects US market hours correctly for daytime trading", () => {
    // Wednesday 2:00 PM ET -> 19:00 UTC
    const wednesdayOpen = new Date("2026-11-04T19:00:00Z");
    const status = getEquityMarketStatus(wednesdayOpen);
    expect(status.isOpen).toBe(true);
    expect(status.statusText).toContain("Market Open");
  });

  it("detects weekend market closed status", () => {
    // Saturday 2:00 PM UTC
    const saturday = new Date("2026-11-07T14:00:00Z");
    const status = getEquityMarketStatus(saturday);
    expect(status.isOpen).toBe(false);
    expect(status.statusText).toContain("Weekend");
  });

  it("computes par status when spread is within 0.5%", () => {
    const comparison = computeNavSpread({
      symbol: "NVDAc",
      name: "NVIDIA Corp (Backed)",
      contractAddress: "0x1234567890123456789012345678901234567890",
      dexPriceUsd: 135.2,
      oracleNavUsd: 135.0,
    });

    expect(comparison.status).toBe("par");
    expect(comparison.spreadPct).toBeCloseTo(0.15, 2);
    expect(comparison.statusLabel).toContain("Par");
  });

  it("identifies premium when DEX price exceeds Oracle NAV by > 0.5%", () => {
    const comparison = computeNavSpread({
      symbol: "TSLAc",
      name: "Tesla Inc (Backed)",
      contractAddress: "0x2222222222222222222222222222222222222222",
      dexPriceUsd: 215.0,
      oracleNavUsd: 200.0,
    });

    expect(comparison.status).toBe("premium");
    expect(comparison.spreadPct).toBe(7.5);
    expect(comparison.statusLabel).toContain("Premium");
  });

  it("identifies discount when DEX price is below Oracle NAV by > 0.5%", () => {
    const comparison = computeNavSpread({
      symbol: "AAPLc",
      name: "Apple Inc (Backed)",
      contractAddress: "0x3333333333333333333333333333333333333333",
      dexPriceUsd: 220.0,
      oracleNavUsd: 225.0,
    });

    expect(comparison.status).toBe("discount");
    expect(comparison.spreadPct).toBeLessThan(0);
    expect(comparison.statusLabel).toContain("Discount");
  });

  it("returns unavailable when price feeds are null without mock data", () => {
    const comparison = computeNavSpread({
      symbol: "MSFTc",
      name: "Microsoft Corp (Backed)",
      contractAddress: "0x4444444444444444444444444444444444444444",
      dexPriceUsd: null,
      oracleNavUsd: 420.0,
    });

    expect(comparison.status).toBe("unavailable");
    expect(comparison.spreadPct).toBeNull();
    expect(comparison.statusLabel).toBe("Unavailable");
  });
});
