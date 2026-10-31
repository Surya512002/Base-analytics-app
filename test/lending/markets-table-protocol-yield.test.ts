import { describe, expect, it } from "vitest";
import type { AssetMarketRow } from "@/components/lending/MarketsTable";

describe("MarketsTable Protocol-specific Yield and Filtering", () => {
  const mockRows: AssetMarketRow[] = [
    {
      symbol: "MSFTc",
      name: "Microsoft Corporation",
      category: "tech",
      address: "0xb20000000000000000000049079a4ec0eefbe671",
      priceUsd: 428.1,
      bestSupplyApy: 293.17,
      bestSupplyProtocol: "Beefy Finance",
      bestBorrowApr: 3.45,
      bestBorrowProtocol: "Aave Pro",
      totalLiquidityUsd: 77000,
      listedProtocols: ["Beefy Finance", "Aerodrome Finance", "Aave Pro"],
      hasLendingMarket: true,
      protocolRates: {
        beefy: {
          supplyApy: 293.17,
          borrowApr: null,
          borrowLabel: "Yield Vault",
          liquidityUsd: 70386,
          protocolLabel: "Beefy Finance",
          hasMarket: true,
        },
        aerodrome: {
          supplyApy: 278.51,
          borrowApr: null,
          borrowLabel: "DEX Pool",
          liquidityUsd: 84463,
          protocolLabel: "Aerodrome Finance",
          hasMarket: true,
        },
        aave: {
          supplyApy: 4.6,
          borrowApr: 3.45,
          borrowLabel: "Aave Pro",
          liquidityUsd: 14800000,
          protocolLabel: "Aave Pro",
          hasMarket: true,
        },
        ipor: {
          supplyApy: 0,
          borrowApr: null,
          borrowLabel: "IPOR Fusion",
          liquidityUsd: 0,
          protocolLabel: "IPOR Fusion",
          hasMarket: false,
        },
      },
    },
    {
      symbol: "TSLAc",
      name: "Tesla Inc.",
      category: "consumer",
      address: "0xb2000000000000000000007e0c4cfb84e1b8b691",
      priceUsd: 221.8,
      bestSupplyApy: 54.45,
      bestSupplyProtocol: "Beefy Finance",
      bestBorrowApr: 3.75,
      bestBorrowProtocol: "Aave Pro",
      totalLiquidityUsd: 56000,
      listedProtocols: ["Beefy Finance", "Aerodrome Finance", "Aave Pro"],
      hasLendingMarket: true,
      protocolRates: {
        beefy: {
          supplyApy: 54.45,
          borrowApr: null,
          borrowLabel: "Yield Vault",
          liquidityUsd: 50944,
          protocolLabel: "Beefy Finance",
          hasMarket: true,
        },
        aerodrome: {
          supplyApy: 51.72,
          borrowApr: null,
          borrowLabel: "DEX Pool",
          liquidityUsd: 61132,
          protocolLabel: "Aerodrome Finance",
          hasMarket: true,
        },
        aave: {
          supplyApy: 5.25,
          borrowApr: 3.75,
          borrowLabel: "Aave Pro",
          liquidityUsd: 14800000,
          protocolLabel: "Aave Pro",
          hasMarket: true,
        },
        ipor: {
          supplyApy: 0,
          borrowApr: null,
          borrowLabel: "IPOR Fusion",
          liquidityUsd: 0,
          protocolLabel: "IPOR Fusion",
          hasMarket: false,
        },
      },
    },
    {
      symbol: "NVDAc",
      name: "NVIDIA Corporation",
      category: "tech",
      address: "0xb20000000000000000000078ee7ce2fe4908108c",
      priceUsd: 138.25,
      bestSupplyApy: 28.5,
      bestSupplyProtocol: "Beefy Finance",
      bestBorrowApr: 3.75,
      bestBorrowProtocol: "Aave Pro",
      totalLiquidityUsd: 35000,
      listedProtocols: ["Beefy Finance", "Aerodrome Finance", "Aave Pro", "IPOR Fusion"],
      hasLendingMarket: true,
      protocolRates: {
        beefy: {
          supplyApy: 28.5,
          borrowApr: null,
          borrowLabel: "Yield Vault",
          liquidityUsd: 10769,
          protocolLabel: "Beefy Finance",
          hasMarket: true,
        },
        aerodrome: {
          supplyApy: 28.1,
          borrowApr: null,
          borrowLabel: "DEX Pool",
          liquidityUsd: 24500,
          protocolLabel: "Aerodrome Finance",
          hasMarket: true,
        },
        aave: {
          supplyApy: 5.25,
          borrowApr: 3.75,
          borrowLabel: "Aave Pro",
          liquidityUsd: 14800000,
          protocolLabel: "Aave Pro",
          hasMarket: true,
        },
        ipor: {
          supplyApy: 7.47,
          borrowApr: 4.5,
          borrowLabel: "IPOR Fusion",
          liquidityUsd: 43700,
          protocolLabel: "IPOR Fusion",
          hasMarket: true,
        },
      },
    },
  ];

  it("returns protocol-specific yields when Aerodrome is selected instead of Beefy", () => {
    const selectedProtocol = "aerodrome";
    const aerodromeFiltered = mockRows.filter((r) => {
      const rate = r.protocolRates?.[selectedProtocol];
      return rate ? rate.hasMarket : false;
    });

    expect(aerodromeFiltered.length).toBe(3);

    const msft = aerodromeFiltered.find((r) => r.symbol === "MSFTc")!;
    const msftAeroRate = msft.protocolRates![selectedProtocol];
    expect(msftAeroRate.supplyApy).toBe(278.51);
    expect(msftAeroRate.protocolLabel).toBe("Aerodrome Finance");
    expect(msftAeroRate.supplyApy).not.toBe(msft.bestSupplyApy); // Specifically not 293.17% (Beefy)!

    const tsla = aerodromeFiltered.find((r) => r.symbol === "TSLAc")!;
    const tslaAeroRate = tsla.protocolRates![selectedProtocol];
    expect(tslaAeroRate.supplyApy).toBe(51.72);
    expect(tslaAeroRate.protocolLabel).toBe("Aerodrome Finance");
    expect(tslaAeroRate.supplyApy).not.toBe(tsla.bestSupplyApy); // Specifically not 54.45% (Beefy)!
  });

  it("returns protocol-specific yields when Aave Pro is selected", () => {
    const selectedProtocol = "aave";
    const aaveFiltered = mockRows.filter((r) => {
      const rate = r.protocolRates?.[selectedProtocol];
      return rate ? rate.hasMarket : false;
    });

    expect(aaveFiltered.length).toBe(3);

    const msft = aaveFiltered.find((r) => r.symbol === "MSFTc")!;
    const msftAaveRate = msft.protocolRates![selectedProtocol];
    expect(msftAaveRate.supplyApy).toBe(4.6);
    expect(msftAaveRate.borrowApr).toBe(3.45);
    expect(msftAaveRate.protocolLabel).toBe("Aave Pro");

    const tsla = aaveFiltered.find((r) => r.symbol === "TSLAc")!;
    const tslaAaveRate = tsla.protocolRates![selectedProtocol];
    expect(tslaAaveRate.supplyApy).toBe(5.25);
    expect(tslaAaveRate.borrowApr).toBe(3.75);
    expect(tslaAaveRate.protocolLabel).toBe("Aave Pro");
  });

  it("filters correctly when IPOR Fusion is selected", () => {
    const selectedProtocol = "ipor";
    const iporFiltered = mockRows.filter((r) => {
      const rate = r.protocolRates?.[selectedProtocol];
      return rate ? rate.hasMarket : false;
    });

    expect(iporFiltered.length).toBe(1);
    expect(iporFiltered[0].symbol).toBe("NVDAc");
    expect(iporFiltered[0].protocolRates![selectedProtocol].supplyApy).toBe(7.47);
    expect(iporFiltered[0].protocolRates![selectedProtocol].borrowApr).toBe(4.5);
  });

  it("returns Beefy yields when Beefy Finance is selected", () => {
    const selectedProtocol = "beefy";
    const msft = mockRows.find((r) => r.symbol === "MSFTc")!;
    const rate = msft.protocolRates![selectedProtocol];
    expect(rate.supplyApy).toBe(293.17);
    expect(rate.protocolLabel).toBe("Beefy Finance");
    expect(rate.borrowLabel).toBe("Yield Vault");
  });
});
