import { describe, expect, it } from "vitest";
import { checkSplit, generateSplit } from "./split";

const E = (s: string) => BigInt(Math.round(Number(s) * 1e6)) * BigInt(10) ** BigInt(12); // wei from a decimal ETH string (6 dp)

const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, BigInt(0));

describe("random split", () => {
  it("1 ETH over 100 cards between 0.001 and 0.02 adds up exactly and stays in range", () => {
    const total = E("1");
    const min = E("0.001");
    const max = E("0.02");
    const xs = generateSplit(total, 100, min, max);
    expect(xs).toHaveLength(100);
    expect(sum(xs)).toBe(total);
    for (const x of xs) {
      expect(x >= min && x <= max).toBe(true);
    }
    // really random: lots of different values, not an equal split
    expect(new Set(xs.map(String)).size).toBeGreaterThan(50);
  });

  it("repeated runs give different orders and the same exact total", () => {
    const total = E("1");
    const a = generateSplit(total, 100, E("0.001"), E("0.02"));
    const b = generateSplit(total, 100, E("0.001"), E("0.02"));
    expect(sum(a)).toBe(total);
    expect(sum(b)).toBe(total);
    expect(a.map(String).join()).not.toBe(b.map(String).join());
  });

  it("edge cases: min*count == total gives all-min; max*count == total gives all-max; 1 claim gets everything", () => {
    expect(generateSplit(E("0.1"), 100, E("0.001"), E("0.5")).every((x) => x === E("0.001"))).toBe(true);
    expect(generateSplit(E("2"), 100, E("0.001"), E("0.02")).every((x) => x === E("0.02"))).toBe(true);
    expect(generateSplit(E("0.3"), 1, E("0.1"), E("0.5"))).toEqual([E("0.3")]);
  });

  it("rejects impossible splits with a clear reason", () => {
    expect(checkSplit(E("0.05"), 100, E("0.001"), E("0.02"))).toMatchObject({ ok: false, error: expect.stringMatching(/too small/) });
    expect(checkSplit(E("5"), 100, E("0.001"), E("0.02"))).toMatchObject({ ok: false, error: expect.stringMatching(/too big/) });
    expect(checkSplit(E("1"), 100, E("0.02"), E("0.001"))).toMatchObject({ ok: false });
    expect(checkSplit(E("1"), 0, E("0.001"), E("0.02"))).toMatchObject({ ok: false });
    expect(checkSplit(E("1"), 100, BigInt(0), E("0.02"))).toMatchObject({ ok: false });
    expect(checkSplit(E("1"), 6000, E("0.00001"), E("0.02"))).toMatchObject({ ok: false });
    expect(() => generateSplit(E("0.05"), 100, E("0.001"), E("0.02"))).toThrow();
  });

  it("works for 6-decimal tokens and odd totals (no dust)", () => {
    const total = BigInt(1_000_003); // 1.000003 USDC
    const xs = generateSplit(total, 7, BigInt(10_000), BigInt(500_000));
    expect(sum(xs)).toBe(total);
    expect(xs.every((x) => x >= BigInt(10_000) && x <= BigInt(500_000))).toBe(true);
  });

  it("many random scenarios always hold the invariants", () => {
    for (let i = 0; i < 200; i++) {
      const count = 1 + Math.floor(Math.random() * 300);
      const min = BigInt(1 + Math.floor(Math.random() * 1000));
      const max = min + BigInt(Math.floor(Math.random() * 100_000));
      const lo = BigInt(count) * min;
      const hi = BigInt(count) * max;
      const total = lo + BigInt(Math.floor(Number(hi - lo) * Math.random()));
      const xs = generateSplit(total, count, min, max);
      expect(sum(xs)).toBe(total);
      expect(xs.every((x) => x >= min && x <= max)).toBe(true);
    }
  });

  it("the first claimer isn't systematically richer (positions are shuffled)", () => {
    let firstBig = 0;
    for (let i = 0; i < 200; i++) {
      const xs = generateSplit(E("1"), 100, E("0.001"), E("0.02"));
      if (xs[0]! > E("0.01")) firstBig++;
    }
    expect(firstBig).toBeGreaterThan(40);
    expect(firstBig).toBeLessThan(160);
  });
});
