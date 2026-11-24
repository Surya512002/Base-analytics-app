import { describe, expect, it } from "vitest";
import { returnPct, returnsFromCandles, type DailyCandle } from "@/lib/stocks/performance";

const DAY = 86_400;
const series = (n: number, price: (i: number) => number): DailyCandle[] =>
  Array.from({ length: n }, (_, i) => ({ t: 1_700_000_000 + i * DAY, c: price(i) }));

describe("returnPct", () => {
  it("measures the move over the period", () => {
    const c = series(40, (i) => 100 + i); // 100 .. 139
    expect(returnPct(c, 30)).toBeCloseTo((139 / 109 - 1) * 100, 6); // reference is 30 days before the last
  });

  it("returns null when history is shorter than the period (no quoting 20 days as 90)", () => {
    const c = series(20, (i) => 100 + i);
    expect(returnPct(c, 30)).toBeNull();
    expect(returnPct(c, 7)).not.toBeNull();
  });

  it("ignores bad candles and handles unsorted input", () => {
    const c = [...series(40, (i) => 100 + i)].reverse();
    c.push({ t: 1_700_000_000 + 5 * DAY, c: Number.NaN }, { t: 1_700_000_000 + 6 * DAY, c: 0 }, { t: 1_700_000_000 + 7 * DAY, c: -3 });
    expect(returnPct(c, 30)).toBeCloseTo((139 / 109 - 1) * 100, 6);
  });

  it("returns null for empty or single-candle history", () => {
    expect(returnPct([], 7)).toBeNull();
    expect(returnPct(series(1, () => 100), 7)).toBeNull();
  });

  it("can be negative", () => {
    expect(returnPct(series(40, (i) => 200 - i), 7)!).toBeLessThan(0);
  });

  it("returnsFromCandles gives each period or null", () => {
    const r = returnsFromCandles(series(35, (i) => 100 + i));
    expect(r[7]).not.toBeNull();
    expect(r[30]).not.toBeNull();
    expect(r[90]).toBeNull();
  });
});
