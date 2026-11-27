import { describe, it, expect } from "vitest";
import { computeLiquidationStatus } from "@/lib/lending/liquidation-math";

describe("MCP Read-Only Tools Suite", () => {
  it("tool: liquidation_status calculates distance to liquidation and remedy amounts", () => {
    const status = computeLiquidationStatus({
      healthFactor: 1.15,
      totalCollateralUsd: 10_000,
      totalDebtUsd: 6_956,
      targetSafeHF: 1.5,
    });

    expect(status.statusTier).toBe("critical");
    expect(status.distancePct).toBeCloseTo(13.0, 1);
    expect(status.recommendedSupplyUsd).toBeGreaterThan(0);
    expect(status.recommendedRepayUsd).toBeGreaterThan(0);
  });
});
