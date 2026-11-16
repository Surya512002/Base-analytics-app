/** Pure helpers behind the Trade page safety UI. No I/O, so they are unit-tested. */

export type OracleState = "fresh" | "aging" | "stale" | "unknown";

export type OracleHealth = { state: OracleState; ageSec: number | null; label: string };

function fmtAge(sec: number): string {
  if (sec < 90) return `${Math.max(0, Math.round(sec))}s`;
  if (sec < 5400) return `${Math.round(sec / 60)}m`;
  if (sec < 172800) return `${(sec / 3600).toFixed(1)}h`;
  return `${Math.round(sec / 86400)}d`;
}

/**
 * How trustworthy the on-chain price is right now. The contract refuses to execute once the feed is older
 * than `maxStalenessSeconds`; "aging" is an early warning at 50% of that window.
 */
export function oracleHealth(updatedAt: number, maxStalenessSeconds: number, nowSec: number): OracleHealth {
  if (!updatedAt || updatedAt <= 0) return { state: "unknown", ageSec: null, label: "Price feed not read yet" };
  const age = Math.max(0, nowSec - updatedAt);
  if (age > maxStalenessSeconds) return { state: "stale", ageSec: age, label: `Price feed paused (${fmtAge(age)} old) — orders will wait` };
  if (age > maxStalenessSeconds / 2) return { state: "aging", ageSec: age, label: `Price feed updated ${fmtAge(age)} ago` };
  return { state: "fresh", ageSec: age, label: `Price feed live (${fmtAge(age)} ago)` };
}

/** `current` moved by `pct` percent (negative = down), at integer basis-point precision. */
export function movePrice(current: bigint, pct: number): bigint {
  const bps = BigInt(Math.round(pct * 100));
  const out = (current * (10_000n + bps)) / 10_000n;
  return out > 0n ? out : 0n;
}

export type SizeAdvice = { level: "ok" | "warn"; message: string | null };

/**
 * Warn when an order is large relative to the pool it has to trade through. Over ~1% of pool liquidity a fill
 * moves the price noticeably; the contract's oracle floor would then refuse it rather than fill badly.
 */
export function sizeAdvice(orderUsd: number | null, liquidityUsd: number | null | undefined): SizeAdvice {
  if (orderUsd == null || !Number.isFinite(orderUsd) || orderUsd <= 0) return { level: "ok", message: null };
  if (liquidityUsd == null || !Number.isFinite(liquidityUsd) || liquidityUsd <= 0) {
    return { level: "warn", message: "Pool liquidity unknown, so we can't estimate how well this order will fill." };
  }
  const share = orderUsd / liquidityUsd;
  if (share > 0.02) {
    return { level: "warn", message: `This order is ${(share * 100).toFixed(1)}% of the pool. It may not fill. Try a smaller size.` };
  }
  if (share > 0.01) {
    return { level: "warn", message: `This order is ${(share * 100).toFixed(1)}% of the pool, so the fill price may move a little.` };
  }
  return { level: "ok", message: null };
}

/** Percent distance of `target` from `current` (both same-scale numbers). */
export function distancePct(current: number, target: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(target) || current <= 0) return null;
  return ((target - current) / current) * 100;
}

export type SimpleGoal = "buy-dip" | "take-profit" | "stop-loss" | "protect";

export const GOAL_COPY: Record<SimpleGoal, { title: string; blurb: string; side: "buy" | "sell" }> = {
  "buy-dip": { title: "Buy the dip", blurb: "Buy automatically if the price falls to your level.", side: "buy" },
  "take-profit": { title: "Sell at a profit", blurb: "Sell automatically when the price rises to your target.", side: "sell" },
  "stop-loss": { title: "Limit my loss", blurb: "Sell automatically if the price falls too far.", side: "sell" },
  protect: { title: "Profit + loss guard", blurb: "Set a profit target and a loss limit together. When one fills, the other cancels.", side: "sell" },
};

/** Default "% from current price" presets per goal. Negative = below the current price. */
export const GOAL_PRESETS: Record<SimpleGoal, number[]> = {
  "buy-dip": [-2, -5, -10, -20],
  "take-profit": [3, 5, 10, 20],
  "stop-loss": [-3, -5, -10, -15],
  protect: [5, 10, 20],
};
