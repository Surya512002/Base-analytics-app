import { describe, it, expect } from "vitest";
import {
  determineYieldRiskTier,
  filterAndSortYieldPools,
  formatRate,
  type UnifiedYieldPool,
} from "@/lib/lending/yield-finder-math";

describe("Yield Finder Filter & Sorting Engine", () => {
  const samplePools: UnifiedYieldPool[] = [
    {
      id: "moonwell-usdc",
      name: "Moonwell Base USDC",
      assetSymbol: "USDC",
      protocol: "moonwell",
      protocolLabel: "Moonwell Base",
      apy: 6.2,
      tvlUsd: 15_000_000,
      riskTier: "low",
      riskReason: "Battle-tested overcollateralized lending pool",
      contractAddress: "0xedc817a28e8b93b03976fb44a3ddb26471961dc3",
      actionType: "supply",
      isStock: false,
    },
    {
      id: "morpho-weth",
      name: "Morpho Blue WETH / USDC",
      assetSymbol: "WETH",
      protocol: "morpho",
      protocolLabel: "Morpho Blue",
      apy: 8.6,
      tvlUsd: 4_200_000,
      riskTier: "low",
      riskReason: "Isolated risk lending market with transparent LLTV",
      contractAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      actionType: "supply",
      isStock: false,
    },
    {
      id: "aerodrome-msftc",
      name: "Aerodrome MSFTc-USDC Gauge",
      assetSymbol: "MSFTc",
      protocol: "aerodrome",
      protocolLabel: "Aerodrome Finance",
      apy: 10.4,
      tvlUsd: 250_000,
      riskTier: "moderate",
      riskReason: "Concentrated liquidity gauge subject to stock market hours",
      contractAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
      actionType: "stake",
      isStock: true,
    },
    {
      id: "beefy-nvdac",
      name: "Beefy Auto-Vault (NVDAc-USDC)",
      assetSymbol: "NVDAc",
      protocol: "beefy",
      protocolLabel: "Beefy Finance",
      apy: 12.8,
      tvlUsd: 380_000,
      riskTier: "moderate",
      riskReason: "Auto-compounding vault over tokenized equity pair",
      contractAddress: "0xdddddddddddddddddddddddddddddddddddddddd",
      actionType: "vault",
      isStock: true,
    },
  ];

  it("assigns risk tiers correctly across protocols", () => {
    const moonwellTier = determineYieldRiskTier({
      protocol: "moonwell",
      isStock: false,
      assetSymbol: "USDC",
    });
    expect(moonwellTier.riskTier).toBe("low");

    const aerodromeStockTier = determineYieldRiskTier({
      protocol: "aerodrome",
      isStock: true,
      assetSymbol: "AAPLc",
    });
    expect(aerodromeStockTier.riskTier).toBe("moderate");
  });

  it("filters pools by asset category (USDC vs Stocks)", () => {
    const usdcOnly = filterAndSortYieldPools(samplePools, {
      assetCategory: "usdc",
    });
    expect(usdcOnly.every((p) => p.name.includes("USDC") || p.assetSymbol === "USDC")).toBe(true);

    const stocksOnly = filterAndSortYieldPools(samplePools, {
      assetCategory: "stocks",
    });
    expect(stocksOnly.every((p) => p.isStock)).toBe(true);
    expect(stocksOnly.length).toBe(2);
  });

  it("filters pools by risk tier", () => {
    const lowRisk = filterAndSortYieldPools(samplePools, {
      riskTier: "low",
    });
    expect(lowRisk.every((p) => p.riskTier === "low")).toBe(true);
    expect(lowRisk.length).toBe(2);
  });

  it("filters pools by minimum TVL threshold", () => {
    const highTvl = filterAndSortYieldPools(samplePools, {
      minTvlUsd: 1_000_000,
    });
    expect(highTvl.every((p) => (p.tvlUsd ?? 0) >= 1_000_000)).toBe(true);
    expect(highTvl.length).toBe(2); // Moonwell & Morpho
  });

  it("sorts pools by APY descending", () => {
    const sorted = filterAndSortYieldPools(samplePools, {
      sortBy: "apy_desc",
    });
    expect(sorted[0].id).toBe("beefy-nvdac"); // 12.8%
    expect(sorted[1].id).toBe("aerodrome-msftc"); // 10.4%
    expect(sorted[2].id).toBe("morpho-weth"); // 8.6%
    expect(sorted[3].id).toBe("moonwell-usdc"); // 6.2%
  });

  it("sorts pools by TVL descending", () => {
    const sorted = filterAndSortYieldPools(samplePools, {
      sortBy: "tvl_desc",
    });
    expect(sorted[0].id).toBe("moonwell-usdc"); // $15M
    expect(sorted[1].id).toBe("morpho-weth"); // $4.2M
  });

  it("sorts pools by APR descending", () => {
    const poolsWithApr: UnifiedYieldPool[] = [
      { ...samplePools[0], apr: 5.2 },
      { ...samplePools[1], apr: 24.5 },
      { ...samplePools[2], apr: 18.0 },
    ];
    const sorted = filterAndSortYieldPools(poolsWithApr, {
      sortBy: "apr_desc",
    });
    expect(sorted[0].id).toBe("morpho-weth"); // 24.5%
    expect(sorted[1].id).toBe("aerodrome-msftc"); // 18.0%
    expect(sorted[2].id).toBe("moonwell-usdc"); // 5.2%
  });

  it("formats rates with precision without rounding low fractions to zero", () => {
    expect(formatRate(0.01)).toBe("0.01%");
    expect(formatRate(0.05)).toBe("0.05%");
    expect(formatRate(5.91)).toBe("5.9%");
    expect(formatRate(88.25)).toBe("88.3%");
    expect(formatRate(0)).toBe("0.0%");
    expect(formatRate(null)).toBe("Unavailable");
    expect(formatRate(undefined)).toBe("Unavailable");
  });
});
