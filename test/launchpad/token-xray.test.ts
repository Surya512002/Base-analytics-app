import { describe, it, expect } from "vitest";
import { computeTokenXRayScore } from "@/lib/launchpad/token-xray";

describe("computeTokenXRayScore", () => {
  it("computes 90+ score for safe, deep-liquidity, renounced token", () => {
    const report = computeTokenXRayScore({
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      liquidityUsd: 100_000,
      top10Pct: 12,
      isOwnerRenounced: true,
      hasMintFunction: false,
      isHoneypot: false,
      isVerified: true,
    });

    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.tier).toBe("low_risk");
    expect(report.warnings).toHaveLength(0);
    expect(report.reasons.length).toBeGreaterThan(2);
  });

  it("penalizes high holder concentration", () => {
    const report = computeTokenXRayScore({
      address: "0x1111111111111111111111111111111111111111",
      liquidityUsd: 15_000,
      top10Pct: 65,
      isOwnerRenounced: true,
      hasMintFunction: false,
    });

    expect(report.factors.concentrationScore).toBe(5);
    expect(report.warnings.some((w) => w.includes("Extreme concentration"))).toBe(true);
  });

  it("flags honeypot with severe high-risk penalty", () => {
    const report = computeTokenXRayScore({
      address: "0x2222222222222222222222222222222222222222",
      isHoneypot: true,
    });

    expect(report.score).toBeLessThanOrEqual(10);
    expect(report.tier).toBe("high_risk");
    expect(report.warnings.some((w) => w.includes("honeypot trap"))).toBe(true);
  });

  it("penalizes active owner mint capability", () => {
    const report = computeTokenXRayScore({
      address: "0x3333333333333333333333333333333333333333",
      isOwnerRenounced: false,
      hasMintFunction: true,
    });

    expect(report.factors.privilegeScore).toBe(5);
    expect(report.warnings.some((w) => w.includes("minting authority"))).toBe(true);
  });
});
