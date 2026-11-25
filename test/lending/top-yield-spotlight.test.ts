import { describe, it, expect } from "vitest";
import type { GaugeRowData } from "@/components/lending/GaugesTable";
import { pickSpotlight, SPOTLIGHT_MIN_TVL_USD } from "@/components/lending/TopYieldSpotlight";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";

const gauge = (id: string, gaugeApr: number, tvlUsd: number): GaugeRowData => ({
  id,
  pairName: `${id}-USDC`,
  stockSymbol: id,
  category: "equities",
  gaugeApr,
  tvlUsd,
  rewardToken: "AERO",
  stakedAmount: 0,
  stakedUsd: 0,
  pendingRewards: 0,
  pendingRewardsUsd: 0,
  contractAddress: "0xAAAA",
});

const lend = {
  marketId: "usdc",
  protocol: "morpho",
  protocolLabel: "Morpho Blue",
  supplyApy: 4.85,
  tvlUsd: 2_000_000,
  type: "lend",
  contractAddress: "0xBBBB",
  supplyAsset: { symbol: "USDC", name: "USD Coin", decimals: 6, isStock: false, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
} as unknown as NormalizedMarket;

describe("Top Yield Spotlight", () => {
  it("never features a tiny pool, however large its rate", () => {
    expect(pickSpotlight([lend], [gauge("HIMSc", 1057.74, 5_880)])?.marketId).toBe("usdc");
  });

  it("picks the highest rate among pools that are big enough", () => {
    expect(pickSpotlight([lend], [gauge("NVDAc", 17.64, 517_538)])?.apy).toBe(17.64);
    expect(pickSpotlight([], [gauge("EDGE", 9, SPOTLIGHT_MIN_TVL_USD)])?.apy).toBe(9);
  });

  it("features nothing when no pool qualifies", () => {
    expect(pickSpotlight([], [gauge("HIMSc", 1057.74, SPOTLIGHT_MIN_TVL_USD - 1)])).toBeNull();
  });
});
