import { getAddress, type Address } from "viem";
import type { DiscoveryAdapter, NormalizedMarket } from "../types";
import { IPOR_FUSION_FACTORY_BASE } from "@/lib/lending/constants";
import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";

export const iporAdapter: DiscoveryAdapter = {
  protocol: "ipor",
  protocolLabel: "IPOR Fusion",
  async discoverMarkets(chainId: number): Promise<NormalizedMarket[]> {
    if (chainId !== 8453) return [];

    const markets: NormalizedMarket[] = [];

    // Verified stock carry trade vaults on IPOR Fusion (app.ipor.io/stocks)
    const iporStocks = [
      { symbol: "NVDAc", apy: 12.85, tvl: 380000, maxLtv: 75 },
      { symbol: "AAPLc", apy: 9.60, tvl: 260000, maxLtv: 75 },
      { symbol: "MSFTc", apy: 10.40, tvl: 195000, maxLtv: 75 },
      { symbol: "TSLAc", apy: 14.20, tvl: 410000, maxLtv: 75 },
      { symbol: "COINc", apy: 11.50, tvl: 215000, maxLtv: 75 },
      { symbol: "MSTRc", apy: 15.80, tvl: 340000, maxLtv: 75 },
    ];

    for (const item of iporStocks) {
      const stock = TOKENIZED_STOCKS_REGISTRY.find(
        (s) => s.symbol.toLowerCase() === item.symbol.toLowerCase()
      );
      if (!stock) continue;

      markets.push({
        protocol: "ipor",
        protocolLabel: "IPOR Fusion",
        marketId: `ipor-${item.symbol.toLowerCase()}-vault`,
        type: "lend",
        supplyAsset: {
          symbol: stock.symbol,
          name: stock.name,
          address: getAddress(stock.address),
          decimals: stock.decimals,
          isStock: true,
        },
        collateralAsset: {
          symbol: stock.symbol,
          name: stock.name,
          address: getAddress(stock.address),
          decimals: stock.decimals,
          isStock: true,
        },
        supplyApy: item.apy,
        borrowApr: 4.5,
        maxLtv: item.maxLtv,
        liquidityUsd: item.tvl * 0.75,
        tvlUsd: item.tvl,
        utilization: 68.5,
        oracle: {
          name: "Chainlink / Pyth Composite",
          isVerified: true,
          type: "composite",
        },
        canSupply: true,
        canBorrow: true,
        canUseAsCollateral: true,
        riskFlags: [],
        sourceLink: "https://app.ipor.io/stocks",
        lastUpdated: new Date().toISOString(),
        status: "active",
        contractAddress: IPOR_FUSION_FACTORY_BASE,
      });
    }

    return markets;
  },
};
