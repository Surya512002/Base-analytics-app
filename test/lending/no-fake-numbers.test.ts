import { describe, expect, it } from "vitest";
import {
  VERIFIED_BEEFY_STOCK_DETAILS,
  VERIFIED_AERODROME_STOCK_POOLS,
  fetchUserStockPortfolioSummary,
} from "@/lib/lending/unified-comparison";
import { BASE_LENDING_MARKETS } from "@/lib/lending/markets";
import { isTrustedSpender } from "@/lib/security/trusted-spenders";

describe("Strict Production Truth: No Fake/Hardcoded Yield or Holdings Numbers", () => {
  it("verifies BASE_LENDING_MARKETS holds no built-in rates or sizes", () => {
    for (const m of BASE_LENDING_MARKETS) {
      expect([m.supplyApy, m.stakingApr ?? 0, m.borrowApr ?? 0, m.tvlUsd], m.id).toEqual([0, 0, 0, 0]);
    }
  });

  it("lists no IPOR factory or other contract the app cannot deposit into", () => {
    expect(new Set(BASE_LENDING_MARKETS.map((m) => m.protocol))).toEqual(new Set(["beefy", "aerodrome"]));
    expect(isTrustedSpender("0x1455717668fA96534f675856347A973fA907e922")).toBe(false);
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

  it("verifies fetchUserStockPortfolioSummary returns 0 holdings and 0 positions for fresh address", async () => {
    const summary = await fetchUserStockPortfolioSummary("0x0000000000000000000000000000000000000001");
    expect(summary.totalStockHoldingsUsd).toBe(0);
    expect(summary.totalStockDebtUsd).toBe(0);
    expect(summary.totalSuppliedUsd).toBe(0);
    expect(summary.totalBorrowedUsd).toBe(0);
    expect(summary.positions).toHaveLength(0);
  });

});
