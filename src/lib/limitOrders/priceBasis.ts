// Pure helpers for the two prices a stock order deals with. No React, no network.
//
// The terminal chart is drawn from DEX pool trades (24/7). Orders trigger on the on-chain Chainlink
// price (the real stock price, which stands still when the market is closed). The two differ by a
// small premium or discount, so a price read off the chart is not the price the order will use.

/** Percent the order price (Chainlink) sits above the terminal (DEX) price. Null if either is unusable. */
export function gapPct(orderPrice: number | null | undefined, terminalPrice: number | null | undefined): number | null {
  if (!orderPrice || !terminalPrice || !(orderPrice > 0) || !(terminalPrice > 0)) return null;
  if (!Number.isFinite(orderPrice) || !Number.isFinite(terminalPrice)) return null;
  return (orderPrice / terminalPrice - 1) * 100;
}

/** Beyond this gap the two feeds disagree too much to trust a conversion; the caller should warn instead. */
export const SUSPECT_GAP_PCT = 10;

export interface ConvertedPrice {
  /** The price to put in the order, on the Chainlink basis. */
  price: number;
  gapPct: number;
  /** True when the gap is so large that a person should double-check before using it. */
  suspect: boolean;
}

/**
 * Convert a price picked on the chart (DEX basis) to the order basis by applying the current gap
 * to it. With no usable feed pair it returns null and the caller keeps the raw price and says so.
 */
export function chartToOrderPrice(chartPrice: number, orderPrice: number | null | undefined, terminalPrice: number | null | undefined): ConvertedPrice | null {
  if (!Number.isFinite(chartPrice) || chartPrice <= 0) return null;
  const gap = gapPct(orderPrice, terminalPrice);
  if (gap === null) return null;
  const ratio = (orderPrice as number) / (terminalPrice as number);
  return { price: chartPrice * ratio, gapPct: gap, suspect: Math.abs(gap) > SUSPECT_GAP_PCT };
}

/** The same order price shown on the terminal's basis, so people can see where it sits on the chart. */
export function orderToTerminalPrice(orderPriceInput: number, orderPrice: number | null | undefined, terminalPrice: number | null | undefined): number | null {
  if (!Number.isFinite(orderPriceInput) || orderPriceInput <= 0) return null;
  if (gapPct(orderPrice, terminalPrice) === null) return null;
  return orderPriceInput * ((terminalPrice as number) / (orderPrice as number));
}

/** Price `pct` percent away from `base` (negative = below). Null for unusable input. */
export function priceAtPct(base: number | null | undefined, pct: number): number | null {
  if (!base || !(base > 0) || !Number.isFinite(pct) || pct <= -100) return null;
  return base * (1 + pct / 100);
}

/** What a stop or target would do to a position worth `valueUsd` at `entry`: dollars and percent. */
export function moveUsd(valueUsd: number, entry: number, level: number): { usd: number; pct: number } | null {
  if (!(valueUsd > 0) || !(entry > 0) || !(level > 0)) return null;
  const pct = (level / entry - 1) * 100;
  return { usd: valueUsd * (level / entry - 1), pct };
}

/** Reward-to-risk for a bracket: how many dollars the target makes for each dollar the stop can lose. */
export function rewardToRisk(entry: number, target: number, stop: number): number | null {
  if (!(entry > 0) || !(target > entry) || !(stop > 0) || !(stop < entry)) return null;
  return (target - entry) / (entry - stop);
}
