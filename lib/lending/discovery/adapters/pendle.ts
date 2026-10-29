import { getAddress, type Address } from "viem";
import type { DiscoveryAdapter, NormalizedMarket } from "../types";
import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";

const PENDLE_MARKETS_URL = "https://api-v2.pendle.finance/core/v1/8453/markets?limit=100";

export const pendleAdapter: DiscoveryAdapter = {
  protocol: "pendle",
  protocolLabel: "Pendle Finance",
  async discoverMarkets(chainId: number): Promise<NormalizedMarket[]> {
    if (chainId !== 8453) return [];

    const markets: NormalizedMarket[] = [];

    try {
      const resp = await fetch(PENDLE_MARKETS_URL, {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      });

      if (!resp.ok) {
        console.warn(`[Pendle Adapter] Failed to fetch markets: HTTP ${resp.status}`);
        return [];
      }

      const data = await resp.json();
      const items = Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : [];

      for (const item of items) {
        const itemTokens = [
          item.name || "",
          item.proName || "",
          item.underlyingAsset?.symbol || "",
          item.accountingAsset?.symbol || "",
          item.pt?.symbol || "",
          item.yt?.symbol || "",
        ].map((t) => t.toLowerCase());

        // Check if market has tokenized stock asset strictly
        const matchedStock = TOKENIZED_STOCKS_REGISTRY.find((stock) => {
          const sym = stock.symbol.toLowerCase();
          const ticker = stock.underlyingTicker.toLowerCase();
          return itemTokens.some((t) => t === sym || t === ticker || t.includes(`-${sym}`) || t.includes(`${sym}-`));
        });

        if (!matchedStock) continue;

        try {
          const marketAddr = getAddress(item.address);
          const impliedApy = Number(item.impliedApy || 0) * 100;
          const underlyingApy = Number(item.underlyingApy || 0) * 100;
          const tvlUsd = Math.round(Number(item.totalLpUsd || item.totalTvlUsd || 0));

          markets.push({
            protocol: "pendle",
            protocolLabel: "Pendle Finance",
            marketId: `pendle-${marketAddr}`,
            type: "stake",
            supplyAsset: {
              symbol: item.name || `${matchedStock.symbol} PT/YT`,
              name: item.proName || `${matchedStock.name} Pendle Market`,
              address: marketAddr,
              decimals: 18,
              isStock: true,
              logo: matchedStock.logo,
            },
            collateralAsset: {
              symbol: matchedStock.symbol,
              name: matchedStock.name,
              address: matchedStock.address,
              decimals: matchedStock.decimals,
              isStock: true,
              logo: matchedStock.logo,
            },
            supplyApy: Math.round((impliedApy || underlyingApy) * 100) / 100,
            maxLtv: 0,
            liquidityUsd: tvlUsd,
            tvlUsd,
            utilization: 100,
            oracle: {
              name: "Pendle PT Oracle",
              isVerified: true,
              type: "composite",
            },
            canSupply: true,
            canBorrow: false,
            canUseAsCollateral: false,
            riskFlags: [],
            sourceLink: `https://app.pendle.finance/trade/markets/${marketAddr}?chain=base`,
            lastUpdated: new Date().toISOString(),
            status: "active",
            badgeText: "Pendle Yield Market",
            contractAddress: marketAddr,
          });
        } catch (itemErr) {
          console.warn(`[Pendle Adapter] Failed to parse market ${item.address}:`, itemErr);
        }
      }
    } catch (err) {
      console.warn("[Pendle Adapter] Discovery failed:", err);
    }

    return markets;
  },
};
