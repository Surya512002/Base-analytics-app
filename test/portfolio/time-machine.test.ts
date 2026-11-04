import { describe, it, expect } from "vitest";
import {
  computeHistoricalValuation,
  generateTaxFriendlyCsv,
} from "@/lib/portfolio/time-machine-math";
import type { PortfolioToken } from "@/lib/portfolio/types";

describe("Portfolio Time Machine Math & Tax Suite", () => {
  const sampleTokens: PortfolioToken[] = [
    {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      balanceRaw: "5000000000",
      balanceFormatted: "5,000",
      balance: 5000,
      balanceNumber: 5000,
      priceUsd: 1.0,
      priceSource: "pegged",
      usdValue: 5000,
      priceChange24h: 0.05,
      logo: null,
      isSpam: false,
      isVerified: true,
      isStock: false,
      isB20: false,
      hasTradeRoute: true,
      counter: { kind: "token", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
    },
    {
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      balanceRaw: "2500000000000000000",
      balanceFormatted: "2.5",
      balance: 2.5,
      balanceNumber: 2.5,
      priceUsd: 3000,
      priceSource: "chainlink",
      usdValue: 7500,
      priceChange24h: 4.5,
      logo: null,
      isSpam: false,
      isVerified: true,
      isStock: false,
      isB20: false,
      hasTradeRoute: true,
      counter: { kind: "token", address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    },
  ];

  it("computes accurate historical valuation for 30d horizon", () => {
    const report = computeHistoricalValuation({
      tokens: sampleTokens,
      daysAgo: 30,
      ethPriceChange24h: 3.0,
    });

    expect(report).not.toBeNull();
    expect(report?.currentTotalUsd).toBe(12500);
    expect(report?.pastTotalUsd).toBeGreaterThan(0);
    expect(report?.daysAgo).toBe(30);
    expect(typeof report?.pnlUsd).toBe("number");
    expect(typeof report?.ethBenchmark.ethPnlPct).toBe("number");
    expect(typeof report?.ethBenchmark.outperformancePct).toBe("number");
  });

  it("returns null when no priced tokens exist without fake fallbacks", () => {
    const unpricedTokens: PortfolioToken[] = [
      {
        address: "0x1111111111111111111111111111111111111111",
        symbol: "MEME",
        name: "Unpriced Token",
        decimals: 18,
        balanceRaw: "1000000000000000000000",
        balanceFormatted: "1,000",
        balance: 1000,
        balanceNumber: 1000,
        priceUsd: null,
        priceSource: "none",
        usdValue: 0,
        priceChange24h: null,
        logo: null,
        isSpam: false,
        isVerified: false,
        isStock: false,
        isB20: false,
        hasTradeRoute: false,
        counter: { kind: "token", address: "0x1111111111111111111111111111111111111111", symbol: "MEME", decimals: 18 },
      },
    ];

    const report = computeHistoricalValuation({
      tokens: unpricedTokens,
      daysAgo: 30,
    });

    expect(report).toBeNull();
  });

  it("handles empty token arrays cleanly", () => {
    const report = computeHistoricalValuation({
      tokens: [],
      daysAgo: 90,
    });

    expect(report).toBeNull();
  });

  it("generates tax-friendly CSV with correct holding period classifications", () => {
    // 30 days -> Short-Term
    const shortTermCsv = generateTaxFriendlyCsv({
      tokens: sampleTokens,
      daysAgo: 30,
    });
    expect(shortTermCsv).toContain("Short-Term (< 1 Year)");
    expect(shortTermCsv).toContain("USD Coin");
    expect(shortTermCsv).toContain("Wrapped Ether");

    // 365 days -> Long-Term
    const longTermCsv = generateTaxFriendlyCsv({
      tokens: sampleTokens,
      daysAgo: 365,
    });
    expect(longTermCsv).toContain("Long-Term (>= 1 Year)");
  });
});
