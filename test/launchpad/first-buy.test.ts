import { describe, expect, it } from "vitest";
import { START_CAP_PRESETS, estimateFirstBuy, seedTokensFor, LAUNCH_SUPPLY } from "@/lib/launchpad/first-buy";
import { DEFAULT_STARTING_PRICE_USD } from "@/lib/launchpad/launch-configs";

describe("launch pricing", () => {
  it("keeps today's default as the lowest starting cap, so no preset needs more seed tokens", () => {
    expect(START_CAP_PRESETS[0].priceUsd).toBe(DEFAULT_STARTING_PRICE_USD);
    for (const p of START_CAP_PRESETS) {
      expect(parseFloat(p.priceUsd)).toBeGreaterThanOrEqual(parseFloat(DEFAULT_STARTING_PRICE_USD));
      expect(p.capUsd).toBeCloseTo(parseFloat(p.priceUsd) * LAUNCH_SUPPLY, 6);
      expect(seedTokensFor(0.01, parseFloat(p.priceUsd), 3000)).toBeLessThanOrEqual(
        seedTokensFor(0.01, parseFloat(DEFAULT_STARTING_PRICE_USD), 3000) + 1e-6
      );
    }
  });

  it("estimates a first buy with constant-product math", () => {
    // 1 ETH seed at $0.0001 with ETH = $2000 -> 20M tokens in the pool.
    const e = estimateFirstBuy({ buyEth: 1, seedEth: 1, startPriceUsd: 0.0001, ethUsd: 2000 })!;
    expect(e.tokens).toBeCloseTo(10_000_000, 0); // half the pool for an equal-size buy
    expect(e.poolTaken).toBeCloseTo(0.5, 6);
    expect(e.priceImpactPct).toBeCloseTo(300, 6); // price x4
    expect(e.marketCapAfterUsd).toBeCloseTo(400_000, 0);
  });

  it("uses half the seed per pool when liquidity is split across two venues", () => {
    const one = estimateFirstBuy({ buyEth: 0.1, seedEth: 1, startPriceUsd: 0.0001, ethUsd: 2000 })!;
    const two = estimateFirstBuy({ buyEth: 0.1, seedEth: 1, startPriceUsd: 0.0001, ethUsd: 2000, pools: 2 })!;
    expect(two.priceImpactPct).toBeGreaterThan(one.priceImpactPct);
  });

  it("returns null without a seeded pool or a valid amount", () => {
    expect(estimateFirstBuy({ buyEth: 0, seedEth: 1, startPriceUsd: 1, ethUsd: 1 })).toBeNull();
    expect(estimateFirstBuy({ buyEth: 1, seedEth: 0, startPriceUsd: 1, ethUsd: 1 })).toBeNull();
  });
});
