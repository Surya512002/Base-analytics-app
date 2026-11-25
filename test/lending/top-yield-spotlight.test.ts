import { describe, it, expect } from "vitest";
import { pickSpotlight, SPOTLIGHT_MIN_TVL_USD } from "@/components/lending/TopYieldSpotlight";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";

const stock = { symbol: "NVDAc", name: "NVIDIA", decimals: 8, isStock: true, address: "0xb20000000000000000000078ee7ce2fE4908108C" };
const market = (over: Record<string, unknown>) =>
  ({
    marketId: "lend",
    protocol: "aave_v4",
    protocolLabel: "Aave",
    type: "lend",
    supplyApy: 4.85,
    tvlUsd: 2_000_000,
    contractAddress: "0xBBBB",
    supplyAsset: stock,
    ...over,
  }) as unknown as NormalizedMarket;

const poolVault = market({ marketId: "lp", protocol: "beefy", type: "lend", supplyApy: 623.67, supplyAsset: { ...stock, symbol: "NVDAc-USDC", isStock: false }, collateralAsset: stock });
const gauge = market({ marketId: "gauge", protocol: "aerodrome", supplyApy: 90 });
// A pair with no stock in it must be recognised too.
const cryptoPair = market({ marketId: "pair", protocol: "beefy", supplyApy: 80, supplyAsset: { ...stock, symbol: "WETH-USDC", isStock: false } });

describe("Top Yield Spotlight", () => {
  it("never features a pool vault or a gauge, however large its rate or size", () => {
    expect(pickSpotlight([poolVault, gauge, cryptoPair, market({})])?.marketId).toBe("lend");
    expect(pickSpotlight([poolVault, gauge, cryptoPair])).toBeNull();
  });

  it("never features a small market", () => {
    const tiny = market({ marketId: "tiny", supplyApy: 1057.74, tvlUsd: 5_880 });
    expect(pickSpotlight([tiny, market({})])?.marketId).toBe("lend");
    expect(pickSpotlight([market({ tvlUsd: SPOTLIGHT_MIN_TVL_USD - 1 })])).toBeNull();
    expect(pickSpotlight([market({ tvlUsd: SPOTLIGHT_MIN_TVL_USD })])?.apy).toBe(4.85);
  });

  it("picks the highest of the qualifying lending rates", () => {
    expect(pickSpotlight([market({}), market({ marketId: "better", supplyApy: 7.47 })])?.marketId).toBe("better");
  });
});
