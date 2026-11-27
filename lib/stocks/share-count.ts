import { formatUnits, parseAbi } from "viem";

/** Coinbase stock tokens publish how many shares one token stands for (1e18 = exactly one). */
export const UI_MULTIPLIER_ABI = parseAbi(["function uiMultiplier() view returns (uint256)"]);

/** "≈ 8 shares" for an amount of stock tokens; null when there is nothing honest to show. */
export function shareCountLabel(tokens: number, multiplier: bigint): string | null {
  const shares = tokens * Number(formatUnits(multiplier, 18));
  if (!Number.isFinite(shares) || shares <= 0) return null;
  const text = shares.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return text === "0" ? null : `≈ ${text} share${text === "1" ? "" : "s"}`;
}
