/**
 * Safety maths for the Aave V4 Equities Hub screens.
 *
 * Health factor ≈ (Σ collateral value × collateral factor) / debt; below 1.0 a position can be liquidated.
 * This is the standard Aave definition; the screens show the contract's own number for the current position
 * and this estimate for "after this action", and say so.
 */

/** The MAX button for borrowing and withdrawing stops here, not at the liquidation line. */
export const SAFE_HEALTH_FACTOR = 1.5;
/** An action that would leave the position below this is blocked. */
export const MIN_HEALTH_FACTOR = 1.1;

export type CollateralLine = { usd: number; collateralFactor: number /* percent */; on: boolean };

/** Σ value × collateral factor over the stocks that are switched on as collateral. */
export function borrowPower(lines: readonly CollateralLine[]): number {
  return lines.filter((l) => l.on).reduce((a, l) => a + (l.usd * l.collateralFactor) / 100, 0);
}

/** null when there is no debt (nothing to liquidate). */
export function healthFactor(power: number, debtUsd: number): number | null {
  if (debtUsd <= 0) return null;
  return power / debtUsd;
}

/** Most USDC that can be borrowed while staying at or above `target`. */
export function maxBorrowUsd(power: number, debtUsd: number, target = SAFE_HEALTH_FACTOR): number {
  return Math.max(0, power / target - debtUsd);
}

/** Most collateral value (USD) that can be taken out while staying at or above `target`. */
export function maxWithdrawPowerUsd(power: number, debtUsd: number, target = SAFE_HEALTH_FACTOR): number {
  return debtUsd <= 0 ? power : Math.max(0, power - debtUsd * target);
}

export type HealthLevel = "none" | "safe" | "watch" | "danger" | "blocked";

export function healthLevel(hf: number | null): HealthLevel {
  if (hf == null) return "none";
  if (hf < MIN_HEALTH_FACTOR) return "blocked";
  if (hf < SAFE_HEALTH_FACTOR) return "danger";
  if (hf < 2) return "watch";
  return "safe";
}

/** USD price at which the stock collateral would hit the liquidation line, other prices unchanged. */
export function liquidationPrice(priceUsd: number, power: number, debtUsd: number, thisStockPower: number): number | null {
  if (debtUsd <= 0 || thisStockPower <= 0) return null;
  const othersPower = power - thisStockPower;
  const neededFromThis = debtUsd - othersPower; // power this stock must still provide at HF = 1
  if (neededFromThis <= 0) return null; // the other collateral alone covers the debt
  return priceUsd * (neededFromThis / thisStockPower);
}
