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
    // Exactly 4 verified stocks hosted by Tau Labs / Atomist
    const iporStocks = [
      { symbol: "GOOGLc", apy: 6.15, tvl: 49100, maxLtv: 75 },
      { symbol: "NVDAc", apy: 7.47, tvl: 43700, maxLtv: 75 },
      { symbol: "AAPLc", apy: 6.85, tvl: 42300, maxLtv: 75 },
      { symbol: "METAc", apy: 7.46, tvl: 32000, maxLtv: 75 },
    ];

    for (const item of iporStocks) {
      const stock = TOKENIZED_STOCKS_REGISTRY.find(
        (s) =>
          s.symbol.toLowerCase() === item.symbol.toLowerCase() ||
          (item.symbol.toLowerCase() === "googc" && s.symbol.toLowerCase() === "googlc")
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
