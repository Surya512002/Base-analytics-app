/**
 * Last check before a swap is sent. The swap fetches a fresh price at that moment, so without this a
 * price that moved (or a badly priced route) would be sent with slippage measured from the new, worse
 * number. A floor is the least the person agreed to receive, in the output token's base units.
 */

/** How far under the market price an unattended trade (no preview screen) may fill. */
export const MAX_UNATTENDED_SHORTFALL_PCT = 5;

/** True when the fresh quote would deliver less than the floor. An unreadable quote counts as below. */
export function belowFloor(amountOutRaw: string | null | undefined, floor: bigint): boolean {
  if (!amountOutRaw || !/^\d+$/.test(amountOutRaw)) return true;
  return BigInt(amountOutRaw) < floor;
}

/** The quote a person was looking at, remembered with what it was a quote for. */
export interface ShownQuote {
  key: string;
  min: bigint;
}

export function rememberQuote(key: string, amountOutMinimum: string | null | undefined): ShownQuote | null {
  if (!amountOutMinimum || !/^\d+$/.test(amountOutMinimum)) return null;
  const min = BigInt(amountOutMinimum);
  return min > 0n ? { key, min } : null;
}

/** The floor for this send, only if the remembered quote is for exactly the same request. */
export function floorFor(shown: ShownQuote | null, key: string): bigint | undefined {
  return shown && shown.key === key ? shown.min : undefined;
}

/**
 * A floor from the market price, for trades nobody previews: selling `amountIn` tokens at `priceUsd`
 * should bring about amountIn x price in USDC; spending `amountIn` USDC should bring about
 * amountIn / price tokens. Null when there is no usable price (the trade should then not be sent).
 */
export function fairFloor(a: {
  side: "buy" | "sell";
  /** Tokens when selling, USDC when buying (human units). */
  amountIn: number;
  priceUsd: number | null | undefined;
  outDecimals: number;
  maxShortfallPct?: number;
}): bigint | null {
  const { side, amountIn, priceUsd, outDecimals } = a;
  const pct = a.maxShortfallPct ?? MAX_UNATTENDED_SHORTFALL_PCT;
  if (!priceUsd || !Number.isFinite(priceUsd) || priceUsd <= 0 || !Number.isFinite(amountIn) || amountIn <= 0) return null;
  if (!Number.isInteger(outDecimals) || outDecimals < 0 || outDecimals > 36 || pct < 0 || pct >= 100) return null;
  const expected = side === "sell" ? amountIn * priceUsd : amountIn / priceUsd;
  const raw = Math.floor(expected * (1 - pct / 100) * 10 ** Math.min(outDecimals, 12));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  // Keep float precision to 12 decimals, then widen in integers.
  return BigInt(raw) * 10n ** BigInt(Math.max(0, outDecimals - 12));
}
