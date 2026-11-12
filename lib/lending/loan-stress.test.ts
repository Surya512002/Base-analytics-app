import { describe, expect, it } from "vitest";
import {
  borrowCost,
  conservativeBorrowLimitUsd,
  healthFactor,
  liquidationPriceUsd,
  loanWarnings,
  maxSurvivableDropPct,
  protocolBorrowCeilingUsd,
  repayOptions,
  riskTier,
  runStress,
  runStressSuite,
  type LoanInputs,
} from "./loan-stress";

const base: LoanInputs = {
  collateralUsd: 1000,
  debtUsd: 500,
  liquidationLtvPct: 80,
  priceUsd: 100,
  borrowAprPct: 4,
};

describe("limits", () => {
  it("conservative limit survives the gap buffer and is below the protocol ceiling", () => {
    expect(protocolBorrowCeilingUsd(1000, 80)).toBe(800);
    expect(conservativeBorrowLimitUsd(1000, 80, 25)).toBe(600);
    expect(conservativeBorrowLimitUsd(1000, 80)).toBeLessThan(protocolBorrowCeilingUsd(1000, 80));
    // borrowing exactly the limit leaves HF = 1.0 right after the buffer gap
    const s = runStress({ ...base, debtUsd: 600 }, 25);
    expect(s.healthFactor).toBeCloseTo(1.0, 6);
  });
  it("handles junk inputs without NaN", () => {
    expect(conservativeBorrowLimitUsd(0, 80)).toBe(0);
    expect(conservativeBorrowLimitUsd(Number.NaN, 80)).toBe(0);
  });
});

describe("health & liquidation price", () => {
  it("computes HF and liquidation price", () => {
    expect(healthFactor(1000, 500, 80)).toBeCloseTo(1.6);
    expect(healthFactor(1000, 0, 80)).toBeNull();
    expect(liquidationPriceUsd(base)).toBeCloseTo(62.5);
    expect(liquidationPriceUsd({ ...base, debtUsd: 0 })).toBeNull();
  });
  it("max survivable drop matches liquidation price", () => {
    expect(maxSurvivableDropPct(base)).toBeCloseTo(37.5);
    expect(maxSurvivableDropPct({ ...base, debtUsd: 0 })).toBe(100);
    expect(maxSurvivableDropPct({ ...base, debtUsd: 900 })).toBe(0);
  });
});

describe("stress suite", () => {
  it("classifies outcomes", () => {
    const [dip, gap, earnings, crash] = runStressSuite(base);
    expect(dip.outcome).toBe("safe");
    expect(gap.outcome).toBe("safe"); // HF 1.28
    expect(earnings.outcome).toBe("tight"); // HF 1.04
    expect(crash.outcome).toBe("liquidatable"); // HF 0.80
    expect(crash.penaltyLossUsd).toBeCloseTo(25); // 5% of 500
  });
  it("flags underwater positions with bad-debt shortfall", () => {
    const s = runStress({ ...base, debtUsd: 700 }, 50);
    expect(s.outcome).toBe("underwater");
    expect(s.shortfallUsd).toBeCloseTo(200);
  });
  it("computes recovery amounts", () => {
    const s = runStress(base, 50);
    expect(s.repayToRecoverUsd).toBeCloseTo(180);
    expect(s.addCollateralToRecoverUsd).toBeCloseTo(281.25);
  });
  it("treats HF exactly 1.0 as liquidatable", () => {
    // 1000 collateral, 70% LLTV, 350 debt → HF 2.0; a 50% gap lands exactly on HF 1.0
    expect(runStress({ ...base, liquidationLtvPct: 70, debtUsd: 350 }, 50).outcome).toBe("liquidatable");
  });
  it("clamps absurd drops", () => {
    expect(runStress(base, 500).collateralUsd).toBe(0);
    expect(runStress(base, -5).collateralUsd).toBe(1000);
  });
});

describe("risk tier", () => {
  it("steps from conservative to danger as debt rises", () => {
    expect(riskTier({ ...base, debtUsd: 0 })).toBe("none");
    expect(riskTier({ ...base, debtUsd: 500 })).toBe("conservative");
    expect(riskTier({ ...base, debtUsd: 600 })).toBe("moderate");
    expect(riskTier({ ...base, debtUsd: 700 })).toBe("aggressive");
    expect(riskTier({ ...base, debtUsd: 800 })).toBe("danger");
  });
});

describe("cost & repay", () => {
  it("computes interest and marks missing rates as unknown, not zero", () => {
    const c = borrowCost(1000, 5);
    expect(c.perYearUsd).toBeCloseTo(50);
    expect(c.perMonthUsd).toBeCloseTo(50 / 12);
    expect(borrowCost(1000, null).unknown).toBe(true);
  });
  it("offers partial / recover / full repay", () => {
    const opts = repayOptions({ ...base, debtUsd: 700 });
    expect(opts.map((o) => o.id)).toEqual(["partial", "recover", "full"]);
    expect(opts[0].repayUsd).toBe(350);
    expect(opts[1].resultingHealthFactor).toBeCloseTo(1.25, 5);
    expect(opts[2].repayUsd).toBe(700);
    expect(repayOptions({ ...base, debtUsd: 0 })).toEqual([]);
  });
});

describe("warnings", () => {
  it("always mentions debt and transfer pauses; adds oracle/market-closed when relevant", () => {
    const ids = loanWarnings(base, { marketOpen: true }).map((w) => w.id);
    expect(ids).toContain("transfers");
    expect(ids).toContain("debt");
    expect(ids).not.toContain("closed");
    const ids2 = loanWarnings({ ...base, debtUsd: 780 }, { marketOpen: false, oraclePaused: true, rateIsEstimate: true }).map((w) => w.id);
    expect(ids2).toEqual(expect.arrayContaining(["thin", "closed", "oracle", "rate"]));
  });
});
