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
 * 50 bps = 0.5% — below typical launchpad ~1% buy fee.
 */
export const LAUNCHPAD_PLATFORM_FEE_BPS = parseFeeBps();

export const LAUNCHPAD_PLATFORM_FEE_PCT = LAUNCHPAD_PLATFORM_FEE_BPS / 100;

/** Human label: 50 bps → "0.5%" */
export function formatPlatformFeeLabel(bps = LAUNCHPAD_PLATFORM_FEE_BPS): string {
  const safe = Number.isFinite(bps) && bps >= 0 ? bps : 50;
  const pct = safe / 100;
  if (pct === 0) return "0%";
  const rounded = pct >= 1 ? pct.toFixed(2) : pct.toFixed(2);
  return `${parseFloat(rounded)}%`;
}
