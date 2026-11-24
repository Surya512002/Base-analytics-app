/**
 * Price performance from daily candles. Pure, so it can be tested. A return is only given when
 * the history really covers the period: a stock listed 20 days ago has no 90-day return, and we
 * say so instead of quoting the 20-day move as if it were 90 days.
 */

export interface DailyCandle {
  /** Unix seconds. */
  t: number;
  /** Close price in USD. */
  c: number;
}

export const RETURN_PERIODS = [7, 30, 90] as const;
export type ReturnPeriod = (typeof RETURN_PERIODS)[number];
export type StockReturns = Record<ReturnPeriod, number | null>;

const DAY = 86_400;

/** Percent change over the last `days` days, or null if the history is too short or the data is unusable. */
export function returnPct(candles: DailyCandle[], days: number): number | null {
  const clean = candles.filter((x) => Number.isFinite(x.t) && Number.isFinite(x.c) && x.c > 0).sort((a, b) => a.t - b.t);
  if (clean.length < 2) return null;
  const last = clean[clean.length - 1];
  const cutoff = last.t - days * DAY;
  // Newest candle at or before the cutoff; nothing there means the history is shorter than the period.
  let ref: DailyCandle | null = null;
  for (const x of clean) {
    if (x.t <= cutoff) ref = x;
    else break;
  }
  if (!ref) return null;
  return (last.c / ref.c - 1) * 100;
}

export function returnsFromCandles(candles: DailyCandle[]): StockReturns {
  return { 7: returnPct(candles, 7), 30: returnPct(candles, 30), 90: returnPct(candles, 90) };
}
