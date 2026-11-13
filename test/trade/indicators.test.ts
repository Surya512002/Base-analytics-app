import { describe, expect, it } from "vitest";
import { bollinger, ema, rsi, sma } from "@/lib/trade/indicators";

describe("trade indicators", () => {
  it("sma averages the trailing window", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it("ema seeds with the sma and stays aligned", () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out.slice(0, 2)).toEqual([null, null]);
    expect(out[2]).toBe(2);
    expect(out[4]).toBeGreaterThan(out[3] as number);
  });
  it("bollinger bands bracket the mean and collapse on flat data", () => {
    const flat = bollinger(new Array(25).fill(10));
    expect(flat.upper[24]).toBe(10);
    expect(flat.lower[24]).toBe(10);
    const b = bollinger([...Array(20).keys()].map((i) => 10 + (i % 2)));
    expect(b.upper[19]!).toBeGreaterThan(b.mid[19]!);
    expect(b.lower[19]!).toBeLessThan(b.mid[19]!);
  });
  it("rsi is 100 on a monotonic rise and low on a fall", () => {
    const up = rsi(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(up[29]).toBe(100);
    const down = rsi(Array.from({ length: 30 }, (_, i) => 100 - i));
    expect(down[29]).toBeLessThan(5);
    expect(rsi([1, 2, 3])).toEqual([null, null, null]);
  });
});
