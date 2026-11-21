import { describe, expect, it } from "vitest";
import { BASKETS, basketLegs } from "@/components/stocks/basket-math";
import { BASE_OFFICIAL_STOCKS } from "@/lib/stocks/base-verified";

const cents = (items: Array<{ amount: string }>) => items.reduce((n, i) => n + Math.round(Number(i.amount) * 100), 0);

describe("stock baskets", () => {
  it("splits the total equally, to the cent, with leftovers on the first stocks", () => {
    const { items, error } = basketLegs(["A", "B", "C"], 10);
    expect(error).toBeUndefined();
    expect(items.map((i) => i.amount)).toEqual(["3.34", "3.33", "3.33"]);
    expect(cents(items)).toBe(1000);
  });

  it("always adds up to the total", () => {
    for (const total of [3, 7, 10.01, 25, 99.99, 100, 1234.56]) {
      for (const n of [2, 3, 4, 5, 7]) {
        const syms = Array.from({ length: n }, (_, i) => `S${i}`);
        const r = basketLegs(syms, total);
        if (!r.error) expect(cents(r.items)).toBe(Math.round(total * 100));
      }
    }
  });

  it("refuses amounts that leave under $1 per stock, and empty input", () => {
    expect(basketLegs(["A", "B", "C", "D"], 3).error).toMatch(/at least \$4/);
    expect(basketLegs(["A", "B"], 0).error).toBeTruthy();
    expect(basketLegs(["A", "B"], Number.NaN).error).toBeTruthy();
    expect(basketLegs(["A"], 50).error).toBeTruthy();
  });

  it("every basket lists only stocks that are live on Base's official list", () => {
    const live = new Set(BASE_OFFICIAL_STOCKS.map((s) => s.symbol));
    for (const b of BASKETS) {
      expect(b.symbols.filter((s) => live.has(s)).length, `${b.id} has at least 2 live stocks`).toBeGreaterThanOrEqual(2);
    }
  });
});
