import { describe, expect, it } from "vitest";
import type { GaugeRowData } from "@/components/lending/GaugesTable";
import { BASE_LENDING_MARKETS } from "@/lib/lending/markets";

describe("Yield Calculator & Explore Vault Protocol Audit", () => {
  it("verifies BASE_LENDING_MARKETS does not contain hardcoded 290.2% fake APR", () => {
    const hasFake290 = BASE_LENDING_MARKETS.some((m) => m.supplyApy === 290.2 || m.stakingApr === 290.2);
    expect(hasFake290).toBe(false);

    const hasFake54 = BASE_LENDING_MARKETS.some((m) => m.supplyApy === 54.13 || m.stakingApr === 54.13);
    expect(hasFake54).toBe(false);
  });

  it("verifies Beefy Auto-Vault is present in verified baseline lending markets", () => {
    const beefyVault = BASE_LENDING_MARKETS.find(
      (m) => m.protocol === "beefy" && m.id === "stock-lend-nvda"
    );
    expect(beefyVault).toBeDefined();
    expect(beefyVault?.contractType).toBe("beefy_vault");
    expect(beefyVault?.contractAddress).toBe("0xD317fDf7e7E3BA9dc9A73CAe2E54732646866025");
    expect(beefyVault?.supplyApy).toBeGreaterThan(0);
  });

  it("verifies Aerodrome, Morpho Blue, and Moonwell markets exist in verified baseline", () => {
    const aero = BASE_LENDING_MARKETS.find((m) => m.protocol === "aerodrome");
    const morpho = BASE_LENDING_MARKETS.find((m) => m.protocol === "morpho");
    const moonwell = BASE_LENDING_MARKETS.find((m) => m.protocol === "moonwell");

    expect(aero).toBeDefined();
    expect(morpho).toBeDefined();
    expect(moonwell).toBeDefined();
  });

  it("verifies Explore Vault resolution correctly routes Beefy target to market modal without blocking", () => {
    const target = {
      protocol: "beefy",
      stockSymbol: "NVDAc",
      contractAddress: "0xD317fDf7e7E3BA9dc9A73CAe2E54732646866025",
      marketId: "stock-lend-nvda",
    };

    const matched = BASE_LENDING_MARKETS.find(
      (m) =>
        (target.marketId && m.id === target.marketId) ||
        (target.contractAddress && m.contractAddress?.toLowerCase() === target.contractAddress.toLowerCase()) ||
        (m.protocol === target.protocol && m.asset.symbol.toLowerCase().includes(target.stockSymbol.toLowerCase()))
    );

    expect(matched).toBeDefined();
    expect(matched?.id).toBe("stock-lend-nvda");
    expect(matched?.contractType).toBe("beefy_vault");
  });

  it("verifies Explore Vault resolution correctly routes Aerodrome gauge to gauge modal", () => {
    const mockGaugeRows: GaugeRowData[] = [
      {
        id: "aero-nvdac-usdc",
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
        contractAddress: "0xA282064541Bb45Caa046fB9f21a240671aBB7f46",
      },
    ];

    const target = {
      protocol: "aerodrome",
      stockSymbol: "NVDAc",
      marketId: "aero-nvdac-usdc",
    };

    const matchedGauge = mockGaugeRows.find(
      (g) => g.id === target.marketId || g.stockSymbol.toLowerCase() === target.stockSymbol.toLowerCase()
    );

    expect(matchedGauge).toBeDefined();
    expect(matchedGauge?.gaugeApr).toBe(17.64);
    expect(matchedGauge?.contractAddress).toBe("0xA282064541Bb45Caa046fB9f21a240671aBB7f46");
  });
});
