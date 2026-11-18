/**
 * How many Coinbase tokenized stocks are live on Base (tokens in circulation), e.g. "87".
 *
 * Taken from the generated live list (refreshed by `npm run stocks:sync`), so the number in
 * OG images and copy always matches the stocks the app actually offers. base.org lists more
 * stocks than this, but the rest have not launched yet (zero supply).
 */
import { COINBASE_LIVE_STOCKS } from "./live-stocks.generated";

export const LIVE_STOCK_COUNT = COINBASE_LIVE_STOCKS.length;
export const TOKENIZED_STOCKS_LABEL = String(LIVE_STOCK_COUNT);

/** Round a count down to the nearest 10 and add "+" (87 → "80+"), for places that want a round number. */
export function stockCountLabel(count: number): string {
  return count < 10 ? String(count) : `${Math.floor(count / 10) * 10}+`;
}
