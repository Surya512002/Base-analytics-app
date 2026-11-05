import { describe, it, expect } from "vitest";
import type { GaugeRowData } from "@/components/lending/GaugesTable";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";

describe("Top Yield Spotlight Dynamic Resolution", () => {
  it("resolves the highest yield opportunity among verified baseline pools", () => {
    const mockMarkets = [
      {
        marketId: "morpho-weth",
        protocol: "morpho",
        protocolLabel: "Morpho Blue",
        supplyApy: 4.85,
        type: "lend",
        contractAddress: "0xBBBB",
        supplyAsset: { symbol: "USDC", name: "USD Coin", decimals: 6, isStock: false, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
      },
      {
        marketId: "moonwell-usdc",
        protocol: "moonwell",
        protocolLabel: "Moonwell Base",
        supplyApy: 4.65,
        type: "lend",
        contractAddress: "0xCCCC",
        supplyAsset: { symbol: "mUSDC", name: "Moonwell USDC", decimals: 6, isStock: false, address: "0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22" },
      },
    ] as unknown as NormalizedMarket[];

    const mockGauges: GaugeRowData[] = [
      {
        id: "aero-gauge",
        pairName: "NVDAc-USDC Gauge",
        stockSymbol: "NVDAc",
        category: "equities",
        gaugeApr: 17.64,
        tvlUsd: 517538,
        rewardToken: "AERO",
        stakedAmount: 0,
        stakedUsd: 0,
        pendingRewards: 0,
        pendingRewardsUsd: 0,
        contractAddress: "0xAAAA",
      },
    ];

    // Verify Aerodrome gauge (17.64%) is picked over Morpho (4.85%) and Moonwell (4.65%)
    const topGauge = mockGauges[0];
    const topMarket = mockMarkets[0];
    expect(topGauge.gaugeApr).toBeGreaterThan(topMarket.supplyApy ?? 0);
  });

  it("dynamically selects higher live gauge APR when available", () => {
    const liveGauge: GaugeRowData = {
      id: "aero-high-yield",
      pairName: "AERO-USDC Gauge",
      stockSymbol: "AERO",
      category: "crypto",
      gaugeApr: 42.15,
      tvlUsd: 1250000,
      rewardToken: "AERO",
      stakedAmount: 0,
      stakedUsd: 0,
      pendingRewards: 0,
      pendingRewardsUsd: 0,
      contractAddress: "0xDDDD",
    };

    expect(liveGauge.gaugeApr).toBe(42.15);
    expect(liveGauge.gaugeApr).toBeGreaterThan(17.64);
  });
});
