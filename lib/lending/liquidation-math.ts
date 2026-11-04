/**
 * Liquidation Guard Calculations
 * Precise formulas for Base lending markets (Aave V3, Morpho Blue, Compound)
 */

export interface LiquidationStatus {
  healthFactor: number | null;
  distancePct: number; // % drop in collateral until HF = 1.0
  bufferUsd: number; // USD loss of collateral before liquidation
  statusTier: "healthy" | "caution" | "critical" | "no_debt";
  statusLabel: string;
  recommendedRepayUsd: number; // Repay required to restore safe HF (1.5)
  recommendedSupplyUsd: number; // Additional collateral required to restore safe HF (1.5)
}

/**
 * Calculates distance to liquidation in percentage drop.
 * HF = (Collateral * LiquidationThreshold) / Debt.
 * Liquidation triggers when HF <= 1.0.
 * Maximum collateral drop before liquidation = (HF - 1) / HF * 100.
 */
export function calculateLiquidationDistance(healthFactor: number | null): number {
  if (healthFactor === null || healthFactor <= 0) return 100;
  if (healthFactor <= 1.0) return 0;
  return Number((((healthFactor - 1.0) / healthFactor) * 100).toFixed(1));
}

/**
 * Simulates health factor given a hypothetical collateral price drop.
 */
export function simulateCollateralDrop(
  healthFactor: number | null,
  dropPercentage: number
): number | null {
  if (healthFactor === null) return null;
  const multiplier = Math.max(0, 1 - dropPercentage / 100);
  return Number((healthFactor * multiplier).toFixed(2));
}

/**
 * Computes full liquidation risk status, buffers, and action amounts.
 */
export function computeLiquidationStatus(params: {
  healthFactor: number | null;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  targetSafeHF?: number;
  liquidationThreshold?: number; // Default 0.80 (80% for ETH/USDC pairs on Base)
}): LiquidationStatus {
  const {
    healthFactor,
    totalCollateralUsd,
    totalDebtUsd,
    targetSafeHF = 1.5,
    liquidationThreshold = 0.8,
  } = params;

  if (totalDebtUsd <= 0 || healthFactor === null) {
    return {
      healthFactor: null,
      distancePct: 100,
      bufferUsd: totalCollateralUsd,
      statusTier: "no_debt",
      statusLabel: "No Active Debt",
      recommendedRepayUsd: 0,
      recommendedSupplyUsd: 0,
    };
  }

  const distancePct = calculateLiquidationDistance(healthFactor);
  const bufferUsd =
    healthFactor > 1.0
      ? Number((totalCollateralUsd * (1 - 1 / healthFactor)).toFixed(2))
      : 0;

  let statusTier: LiquidationStatus["statusTier"] = "healthy";
  let statusLabel = "Safe Buffer";

  if (healthFactor <= 1.05) {
    statusTier = "critical";
    statusLabel = "Imminent Liquidation";
  } else if (healthFactor < 1.25) {
    statusTier = "critical";
    statusLabel = "High Liquidation Risk";
  } else if (healthFactor < 1.5) {
    statusTier = "caution";
    statusLabel = "Moderate Caution";
  }

  // Calculate remedies to reach targetSafeHF
  let recommendedSupplyUsd = 0;
  let recommendedRepayUsd = 0;

  if (healthFactor < targetSafeHF) {
    const requiredCollateral = (targetSafeHF * totalDebtUsd) / liquidationThreshold;
    recommendedSupplyUsd = Math.max(0, Number((requiredCollateral - totalCollateralUsd).toFixed(2)));

    const maxAllowableDebt = (totalCollateralUsd * liquidationThreshold) / targetSafeHF;
    recommendedRepayUsd = Math.max(0, Number((totalDebtUsd - maxAllowableDebt).toFixed(2)));
  }

  return {
    healthFactor,
    distancePct,
    bufferUsd,
    statusTier,
    statusLabel,
    recommendedRepayUsd,
    recommendedSupplyUsd,
  };
}
