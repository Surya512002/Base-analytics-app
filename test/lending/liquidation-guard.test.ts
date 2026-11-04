import { describe, it, expect } from "vitest";
import {
  calculateLiquidationDistance,
  simulateCollateralDrop,
  computeLiquidationStatus,
} from "@/lib/lending/liquidation-math";

describe("Liquidation Guard Math", () => {
  it("calculates accurate distance to liquidation", () => {
    // HF = 2.0 -> collateral can drop 50% before HF = 1.0
    expect(calculateLiquidationDistance(2.0)).toBe(50);

    // HF = 1.25 -> (1.25 - 1.0) / 1.25 = 0.20 -> 20%
    expect(calculateLiquidationDistance(1.25)).toBe(20);

    // HF = 1.0 -> already liquidatable
    expect(calculateLiquidationDistance(1.0)).toBe(0);

    // HF <= 0.95 -> 0%
    expect(calculateLiquidationDistance(0.95)).toBe(0);

    // No debt (null) -> 100%
    expect(calculateLiquidationDistance(null)).toBe(100);
  });

  it("simulates collateral drops correctly", () => {
    // Current HF 2.0 with a 10% drop -> 1.80
    expect(simulateCollateralDrop(2.0, 10)).toBe(1.8);

    // Current HF 1.25 with a 20% drop -> 1.00
    expect(simulateCollateralDrop(1.25, 20)).toBe(1.0);

    // Current HF 1.50 with a 50% drop -> 0.75
    expect(simulateCollateralDrop(1.5, 50)).toBe(0.75);

    // Null HF returns null
    expect(simulateCollateralDrop(null, 15)).toBeNull();
  });

  it("computes full liquidation status for safe positions", () => {
    const status = computeLiquidationStatus({
      healthFactor: 2.5,
      totalCollateralUsd: 10_000,
      totalDebtUsd: 3_200,
    });

    expect(status.statusTier).toBe("healthy");
    expect(status.distancePct).toBe(60);
    expect(status.bufferUsd).toBe(6000);
    expect(status.recommendedRepayUsd).toBe(0);
    expect(status.recommendedSupplyUsd).toBe(0);
  });

  it("computes remedy amounts for critical positions (HF < 1.25)", () => {
    // Collateral $2,500, Debt $2,000, LT 0.8 -> HF = (2500 * 0.8) / 2000 = 1.0
    const status = computeLiquidationStatus({
      healthFactor: 1.1,
      totalCollateralUsd: 2_750,
      totalDebtUsd: 2_000,
      liquidationThreshold: 0.8,
    });

    expect(status.statusTier).toBe("critical");
    expect(status.statusLabel).toBe("High Liquidation Risk");
    expect(status.distancePct).toBeCloseTo(9.1, 1);
    expect(status.recommendedSupplyUsd).toBeGreaterThan(0);
    expect(status.recommendedRepayUsd).toBeGreaterThan(0);

    // Target safe HF 1.5 requires collateral = (1.5 * 2000) / 0.8 = 3750 -> supply 1000
    expect(status.recommendedSupplyUsd).toBe(1000);
  });

  it("handles zero debt / non-borrowing users cleanly", () => {
    const status = computeLiquidationStatus({
      healthFactor: null,
      totalCollateralUsd: 5_000,
      totalDebtUsd: 0,
    });

    expect(status.statusTier).toBe("no_debt");
    expect(status.statusLabel).toBe("No Active Debt");
    expect(status.distancePct).toBe(100);
    expect(status.recommendedRepayUsd).toBe(0);
  });
});
