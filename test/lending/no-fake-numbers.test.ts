import { describe, expect, it } from "vitest";
import {
  VERIFIED_BEEFY_STOCK_DETAILS,
  VERIFIED_AERODROME_STOCK_POOLS,
  VERIFIED_IPOR_STOCK_VAULTS,
  fetchUserStockPortfolioSummary,
} from "@/lib/lending/unified-comparison";
import { computeStockTerminalScore } from "@/components/wallet/StockPortfolioBreakdownCard";
import { BASE_LENDING_MARKETS } from "@/lib/lending/markets";

describe("Strict Production Truth: No Fake/Hardcoded Yield or Holdings Numbers", () => {
  it("verifies BASE_LENDING_MARKETS does not contain legacy fake rates (290.2% or 54.13%)", () => {
    const hasFake290 = BASE_LENDING_MARKETS.some(
      (m) => m.supplyApy === 290.2 || m.stakingApr === 290.2
    );
    expect(hasFake290).toBe(false);

    const hasFake54 = BASE_LENDING_MARKETS.some(
      (m) => m.supplyApy === 54.13 || m.stakingApr === 54.13
    );
    expect(hasFake54).toBe(false);
  });

  it("verifies VERIFIED_BEEFY_STOCK_DETAILS does not contain hardcoded fake APYs or TVLs", () => {
    for (const [sym, details] of Object.entries(VERIFIED_BEEFY_STOCK_DETAILS)) {
      expect(
        details.apy ?? 0,
        `Beefy vault for ${sym} must not have hardcoded mock APY`
      ).toBe(0);
      expect(
        details.tvlUsd ?? 0,
        `Beefy vault for ${sym} must not have hardcoded mock TVL`
      ).toBe(0);
    }
  });

  it("verifies VERIFIED_AERODROME_STOCK_POOLS does not contain hardcoded fake APYs or TVLs", () => {
    for (const [sym, details] of Object.entries(VERIFIED_AERODROME_STOCK_POOLS)) {
      expect(
        details.supplyApy ?? 0,
        `Aerodrome pool for ${sym} must not have hardcoded mock APY`
      ).toBe(0);
      expect(
        details.tvlUsd ?? 0,
        `Aerodrome pool for ${sym} must not have hardcoded mock TVL`
      ).toBe(0);
    }
  });

  it("verifies VERIFIED_IPOR_STOCK_VAULTS does not contain hardcoded fake APYs or TVLs", () => {
    for (const [sym, details] of Object.entries(VERIFIED_IPOR_STOCK_VAULTS)) {
      expect(
        details.apy ?? 0,
        `IPOR vault for ${sym} must not have hardcoded mock APY`
      ).toBe(0);
      expect(
        details.tvlUsd ?? 0,
        `IPOR vault for ${sym} must not have hardcoded mock TVL`
      ).toBe(0);
    }
  });

  it("verifies fetchUserStockPortfolioSummary returns 0 holdings and 0 positions for fresh address", async () => {
    const summary = await fetchUserStockPortfolioSummary("0x0000000000000000000000000000000000000001");
    expect(summary.totalStockHoldingsUsd).toBe(0);
    expect(summary.totalStockDebtUsd).toBe(0);
    expect(summary.totalSuppliedUsd).toBe(0);
    expect(summary.totalBorrowedUsd).toBe(0);
    expect(summary.positions).toHaveLength(0);
  });

  it("verifies computeStockTerminalScore returns score 0 for empty portfolio without fake fallbacks", () => {
    const emptyScore = computeStockTerminalScore(0, 0, 999, 0);
    expect(emptyScore.score).toBe(0);
    expect(emptyScore.components.exposure).toBe(0);
    expect(emptyScore.components.productiveLending).toBe(0);
    expect(emptyScore.components.diversification).toBe(0);
    expect(emptyScore.components.healthDiscipline).toBe(0);
  });
});
