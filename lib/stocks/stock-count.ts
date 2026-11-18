/**
 * Marketing count of Coinbase tokenized stocks the app supports, e.g. "350+".
 *
 * Kept as a tiny constant so OG images and other lightweight bundles don't import the full
 * registry. `stock-count.test.ts` fails CI when the real list (BASE_VERIFIED_STOCKS) moves
 * past the next 50, so this can't silently go stale again.
 */
export const TOKENIZED_STOCKS_LABEL = "350+";

/** Round a count down to the nearest 50 and add "+" (358 → "350+"). */
export function stockCountLabel(count: number): string {
  return `${Math.floor(count / 50) * 50}+`;
}
