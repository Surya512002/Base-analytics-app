import { APP_TREASURY } from "@/lib/constants/treasury";

function parseFeeBps(): number {
  const raw =
    process.env.NEXT_PUBLIC_LAUNCHPAD_PLATFORM_FEE_BPS ||
    process.env.LAUNCHPAD_PLATFORM_FEE_BPS ||
    "50";
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 0) return 50;
  return Math.min(300, n);
}

/** Platform treasury — defaults to app treasury. */
export const LAUNCHPAD_TREASURY = (
  process.env.NEXT_PUBLIC_LAUNCHPAD_TREASURY ||
  process.env.LAUNCHPAD_TREASURY ||
  APP_TREASURY
) as `0x${string}`;

/**
 * Swap platform fee in basis points.
 * - Platform-launched tokens (B20 / memes): 50 bps = 0.50% (0.25% creator revenue share + 0.25% platform).
 * - Other trading tokens & tokenized stocks: 25 bps = 0.25% (lowest fee on Base, 100% platform, 0% creator fee).
 */
export const LAUNCHPAD_LAUNCHED_FEE_BPS = 50;
export const LAUNCHPAD_TRADING_FEE_BPS = 25;

export const LAUNCHPAD_PLATFORM_FEE_BPS = parseFeeBps();

export const LAUNCHPAD_PLATFORM_FEE_PCT = LAUNCHPAD_PLATFORM_FEE_BPS / 100;

export function getPlatformFeeBps(isLaunched: boolean): number {
  return isLaunched ? LAUNCHPAD_LAUNCHED_FEE_BPS : LAUNCHPAD_TRADING_FEE_BPS;
}

/** Human label: 50 bps → "0.5%", 25 bps → "0.25%" */
export function formatPlatformFeeLabel(bps = LAUNCHPAD_TRADING_FEE_BPS): string {
  const safe = Number.isFinite(bps) && bps >= 0 ? bps : 25;
  const pct = safe / 100;
  if (pct === 0) return "0%";
  const rounded = pct.toFixed(2);
  return `${parseFloat(rounded)}%`;
}
