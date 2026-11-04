import { describe, it, expect } from "vitest";
import { computeTokenXRayScore } from "@/lib/launchpad/token-xray";
import { computeLiquidationStatus } from "@/lib/lending/liquidation-math";
import { filterAndSortYieldPools, type UnifiedYieldPool } from "@/lib/lending/yield-finder-math";

describe("MCP Read-Only Tools Suite", () => {
  it("tool: token_xray audits contract safety accurately", () => {
    const report = computeTokenXRayScore({
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      liquidityUsd: 100_000,
      top10Pct: 12,
      isVerified: true,
    });

    expect(report.score).toBeGreaterThanOrEqual(85);
    expect(report.tier).toBe("low_risk");
    expect(report.factors.lpLockScore).toBe(25);
  });

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

  it("tool: yield_finder filters pools by asset, TVL and risk tier", () => {
    const samplePools: UnifiedYieldPool[] = [
      {
        id: "beefy-nvdac",
        name: "Beefy Auto-Vault (NVDAc-USDC)",
        assetSymbol: "NVDAc-USDC",
        protocol: "beefy",
        protocolLabel: "Beefy Finance",
        apy: 12.8,
        tvlUsd: 380_000,
        riskTier: "moderate",
        riskReason: "Auto-compounding vault",
        contractAddress: "0x2e86488a0fc2e30f2c4ec3e62fec2e5b6adab290",
        actionType: "vault",
        isStock: true,
      },
      {
        id: "moonwell-usdc",
        name: "Moonwell Base USDC",
        assetSymbol: "USDC",
        protocol: "moonwell",
        protocolLabel: "Moonwell Base",
        apy: 6.2,
        tvlUsd: 15_000_000,
        riskTier: "low",
        riskReason: "Overcollateralized pool",
        contractAddress: "0xedc817a28e8b93b03976fb44a3ddb26471961dc3",
        actionType: "supply",
        isStock: false,
      },
    ];

    const lowRiskOnly = filterAndSortYieldPools(samplePools, { riskTier: "low" });
    expect(lowRiskOnly.length).toBe(1);
    expect(lowRiskOnly[0].protocol).toBe("moonwell");

    const highTvlOnly = filterAndSortYieldPools(samplePools, { minTvlUsd: 1_000_000 });
    expect(highTvlOnly.length).toBe(1);
    expect(highTvlOnly[0].id).toBe("moonwell-usdc");
  });
});
