import { describe, it, expect } from "vitest";
import { computeLaunchReadiness } from "@/lib/launchpad/readiness-simulator";

describe("Launch Readiness Simulator", () => {
  it("computes 90+ Grade A+ score for secure, deep, 1-year locked launch", () => {
    const report = computeLaunchReadiness({
      poolReservePct: 80,
      creatorPct: 10,
      autoSeedLiquidity: true,
      seedLiquidityEth: "0.5",
      liquidityLocked: true,
      lockDurationDays: 365,
      antiSnipeBlocks: 8,
    });

    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.grade).toBe("A+");
    expect(report.checks.every((c) => c.passed)).toBe(true);
    expect(report.recommendations.length).toBe(0);
  });

  it("penalizes unlocked liquidity heavily", () => {
    const report = computeLaunchReadiness({
      poolReservePct: 80,
      creatorPct: 10,
      autoSeedLiquidity: true,
      seedLiquidityEth: "0.5",
      liquidityLocked: false,
      lockDurationDays: 0,
      antiSnipeBlocks: 8,
    });

    const lockCheck = report.checks.find((c) => c.name === "LP Lock Duration");
    expect(lockCheck?.score).toBe(0);
    expect(lockCheck?.passed).toBe(false);
    expect(report.recommendations.some((r) => r.includes("Lock liquidity"))).toBe(true);
  });

  it("penalizes zero liquidity and disabled anti-snipe", () => {
    const report = computeLaunchReadiness({
      poolReservePct: 40,
      creatorPct: 40,
      autoSeedLiquidity: false,
      seedLiquidityEth: "0",
      liquidityLocked: false,
      lockDurationDays: 0,
      antiSnipeBlocks: 0,
    });

    expect(report.score).toBeLessThanOrEqual(25);
    expect(report.grade).toBe("C");
    expect(report.tierLabel).toContain("High Risk");
    expect(report.recommendations.length).toBeGreaterThanOrEqual(3);
  });
});
