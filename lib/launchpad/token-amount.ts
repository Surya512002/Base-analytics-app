import { formatUnits, parseUnits } from "viem";

/** Human-readable token amount for inputs (preserves small balances). Never uses scientific notation. */
export function formatTokenInputAmount(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  const dec = Math.min(Math.max(decimals, 0), 18);
  if (value >= 1) {
    return value.toFixed(Math.min(6, Math.max(2, dec))).replace(/\.?0+$/, "") || "0";
  }
  const maxFrac = Math.min(Math.max(dec, 6), 12);
  const s = value.toFixed(maxFrac).replace(/\.?0+$/, "");
  return s || "0";
}

/** Strip trailing zeros; cap fractional digits so viem parseUnits won't reject the string. */
export function sanitizeTokenAmountInput(raw: string, decimals: number): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === ".") return "";
  if (/e/i.test(trimmed)) return "";
  const dec = Math.min(Math.max(decimals, 0), 78);
  const parts = trimmed.split(".");
  const whole = parts[0]?.replace(/^0+(?=\d)/, "") || "0";
  if (parts.length === 1) return whole === "" ? "0" : whole;
  const frac = (parts[1] ?? "").slice(0, dec).replace(/0+$/, "");
  if (!frac) return whole === "" ? "0" : whole;
  return `${whole}.${frac}`;
}

/** Apply a balance fraction from an on-chain raw balance — no float drift. */
export function amountFromRawBalanceFraction(
  rawBalance: bigint,
  decimals: number,
  fraction: number
): string {
  if (rawBalance <= BigInt(0) || fraction <= 0) return "0";
  const dec = Math.min(Math.max(decimals, 0), 78);
  const scaled =
    (rawBalance * BigInt(Math.round(fraction * 10_000))) / BigInt(10_000);
  if (scaled <= BigInt(0)) return "0";
  return sanitizeTokenAmountInput(formatUnits(scaled, dec), dec);
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
    return amountFromRawBalanceFraction(raw, dec, fraction);
  } catch {
    return sanitizeTokenAmountInput(
      formatTokenInputAmount(balance * fraction, decimals),
      decimals
    );
  }
}

/** Display balance in UI hints (wallet row, balance label). */
export function formatTokenBalanceDisplay(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  if (value >= 1) {
    return value.toLocaleString("en-US", { maximumFractionDigits: Math.min(4, Math.max(decimals, 2)) });
  }
  if (value >= 0.0001) {
    return value.toFixed(Math.min(6, Math.max(decimals, 4))).replace(/0+$/, "").replace(/\.$/, "");
  }
  const s = value.toFixed(Math.min(8, Math.max(decimals, 8))).replace(/0+$/, "").replace(/\.$/, "");
  return s === "0" ? "<0.00000001" : s;
}
