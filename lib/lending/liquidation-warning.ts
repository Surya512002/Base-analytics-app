/** Warn under this health factor, and at most this often while it stays there. */
export const WARN_HEALTH_FACTOR = 1.25;
export const WARN_AGAIN_AFTER_MS = 6 * 60 * 60 * 1000;

export function shouldWarnLiquidation(input: { enabled: boolean; healthFactor: number | null; debtUsd: number; lastWarnedAt: number; now: number }): boolean {
  const { enabled, healthFactor, debtUsd, lastWarnedAt, now } = input;
  return enabled && debtUsd > 0 && healthFactor !== null && healthFactor < WARN_HEALTH_FACTOR && now - lastWarnedAt >= WARN_AGAIN_AFTER_MS;
}
