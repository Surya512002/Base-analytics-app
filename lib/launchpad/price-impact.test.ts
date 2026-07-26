import { describe, expect, it } from "vitest";
import {
  estimatePriceImpactBps,
  priceImpactBpsFromProbe,
  probeAmountFor,
} from "@/lib/launchpad/price-impact";

describe("probeAmountFor", () => {
  it("takes a thousandth of the order", () => {
    expect(probeAmountFor(BigInt(1_000_000))).toBe(BigInt(1000));
  });

  it("never rounds down to zero for tiny orders", () => {
    expect(probeAmountFor(BigInt(5))).toBe(BigInt(1));
  });

  it("returns zero for a non-positive order", () => {
    expect(probeAmountFor(BigInt(0))).toBe(BigInt(0));
  });
});

describe("priceImpactBpsFromProbe", () => {
  it("reports zero when execution matches the marginal rate", () => {
    expect(
      priceImpactBpsFromProbe({
        amountIn: BigInt(1000),
        amountOut: BigInt(2000),
        probeIn: BigInt(1),
        probeOut: BigInt(2),
      })
    ).toBe(0);
  });

  it("reports 1% when execution is 1% worse than marginal", () => {
    expect(
      priceImpactBpsFromProbe({
        amountIn: BigInt(1000),
        amountOut: BigInt(1980),
        probeIn: BigInt(1),
        probeOut: BigInt(2),
      })
    ).toBe(100);
  });

  it("reports 50% when execution is half the marginal rate", () => {
    expect(
      priceImpactBpsFromProbe({
        amountIn: BigInt(1000),
        amountOut: BigInt(1000),
        probeIn: BigInt(1),
        probeOut: BigInt(2),
      })
    ).toBe(5000);
  });

  it("stays precise at 18-decimal magnitudes", () => {
    const one = BigInt(10) ** BigInt(18);
    // 2.5% worse than the marginal rate of 3000 tokens per unit.
    expect(
      priceImpactBpsFromProbe({
        amountIn: one,
        amountOut: BigInt(2925) * one,
        probeIn: one / BigInt(1000),
        probeOut: (BigInt(3000) * one) / BigInt(1000),
      })
    ).toBe(250);
  });

  it("clamps a better-than-marginal result to zero instead of going negative", () => {
    expect(
      priceImpactBpsFromProbe({
        amountIn: BigInt(1000),
        amountOut: BigInt(2100),
        probeIn: BigInt(1),
        probeOut: BigInt(2),
      })
    ).toBe(0);
  });

  it("returns null when the probe came back empty", () => {
    expect(
      priceImpactBpsFromProbe({
        amountIn: BigInt(1000),
        amountOut: BigInt(2000),
        probeIn: BigInt(1),
        probeOut: BigInt(0),
      })
    ).toBeNull();
  });

  it("returns null when the quote itself is empty", () => {
    expect(
      priceImpactBpsFromProbe({
        amountIn: BigInt(1000),
        amountOut: BigInt(0),
        probeIn: BigInt(1),
        probeOut: BigInt(2),
      })
    ).toBeNull();
  });
});

describe("estimatePriceImpactBps", () => {
  it("prices a constant-product pool close to the analytic impact", async () => {
    // x*y=k with 1000 in reserve each side; selling 10 costs ~0.99% versus marginal.
    const reserveIn = BigInt(1000) * BigInt(10) ** BigInt(18);
    const reserveOut = BigInt(1000) * BigInt(10) ** BigInt(18);
    const swap = (dx: bigint) => (reserveOut * dx) / (reserveIn + dx);

    const amountIn = BigInt(10) * BigInt(10) ** BigInt(18);
    const impact = await estimatePriceImpactBps({
      amountIn,
      amountOut: swap(amountIn),
      probe: async (probeIn) => swap(probeIn),
    });

    expect(impact).not.toBeNull();
    expect(impact!).toBeGreaterThan(95);
    expect(impact!).toBeLessThan(101);
  });

  it("returns null when the probe throws", async () => {
    const impact = await estimatePriceImpactBps({
      amountIn: BigInt(1000),
      amountOut: BigInt(2000),
      probe: async () => {
        throw new Error("rpc down");
      },
    });
    expect(impact).toBeNull();
  });
});
