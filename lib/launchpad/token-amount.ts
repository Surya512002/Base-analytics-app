import { formatUnits, parseUnits } from "viem";

/** Human-readable token amount for inputs (preserves small balances). */
export function formatTokenInputAmount(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1) {
    return value.toFixed(Math.min(6, Math.max(2, decimals))).replace(/\.?0+$/, "") || "0";
  }
  const maxFrac = Math.min(Math.max(decimals, 6), 12);
  const s = value.toFixed(maxFrac).replace(/\.?0+$/, "");
  return s || value.toExponential(4);
}

/** Apply a balance fraction using integer math to avoid float dust / rounding to zero. */
export function amountFromBalanceFraction(
  balance: number,
  decimals: number,
  fraction: number
): string {
  if (!Number.isFinite(balance) || balance <= 0 || fraction <= 0) return "0";
  try {
    const dec = Math.min(Math.max(decimals, 0), 18);
    const balanceStr = balance.toFixed(dec);
    const raw = parseUnits(balanceStr, dec);
    const scaled = (raw * BigInt(Math.round(fraction * 10_000))) / BigInt(10_000);
    if (scaled <= BigInt(0)) return "0";
    const out = formatUnits(scaled, dec);
    return out.includes(".") ? out.replace(/\.?0+$/, "") || "0" : out;
  } catch {
    return formatTokenInputAmount(balance * fraction, decimals);
  }
}

/** Display balance in UI hints (wallet row, balance label). */
export function formatTokenBalanceDisplay(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (value >= 1) return value.toFixed(Math.min(4, decimals));
  if (value >= 0.0001) return value.toFixed(Math.min(6, decimals));
  return value.toPrecision(4);
}
