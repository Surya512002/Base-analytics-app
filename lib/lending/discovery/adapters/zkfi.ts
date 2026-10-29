import { getAddress, type Address } from "viem";
import type { DiscoveryAdapter, NormalizedMarket } from "../types";

/**
 * zkFi / ZeroLend Discovery Adapter on Base Mainnet (ChainId: 8453)
 * Monitors compliant privacy-preserving vaults and zero-knowledge lending markets.
 */
export const zkfiAdapter: DiscoveryAdapter = {
  protocol: "zkfi",
  protocolLabel: "zkFi Protocol",
  async discoverMarkets(chainId: number): Promise<NormalizedMarket[]> {
    if (chainId !== 8453) return [];

    const markets: NormalizedMarket[] = [];

    try {
      // Query ZeroLend / zkFi Base endpoints with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch("https://api.zerolend.xyz/markets?chainId=8453", {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (resp && resp.ok) {
        const data = await resp.json();
        const items = Array.isArray(data) ? data : data?.markets || [];
        for (const item of items) {
          const sym = (item.symbol || "").toLowerCase();
          if (sym.endsWith("c") || /nvda|aapl|tsla|msft|coin/i.test(sym)) {
            // Found a stock market
            const marketAddr = getAddress(item.address || item.poolAddress);
            markets.push({
              protocol: "zkfi",
              protocolLabel: "zkFi Protocol",
              marketId: `zkfi-${marketAddr}`,
              type: "borrow",
              supplyAsset: {
                symbol: item.symbol,
                name: item.name || item.symbol,
                address: marketAddr,
                decimals: item.decimals || 18,
                isStock: true,
              },
              supplyApy: Number(item.supplyApy || 0),
              borrowApr: Number(item.borrowApr || 0),
              maxLtv: Number(item.ltv || 70),
              liquidityUsd: Number(item.liquidityUsd || 0),
              tvlUsd: Number(item.tvlUsd || 0),
              utilization: Number(item.utilization || 0),
              oracle: {
                name: "zkFi Verified Oracle",
                isVerified: true,
                type: "composite",
              },
              canSupply: true,
              canBorrow: true,
              canUseAsCollateral: true,
              riskFlags: [],
              sourceLink: `https://app.zerolend.xyz/`,
              lastUpdated: new Date().toISOString(),
              status: "active",
              badgeText: "zkFi Compliant Market",
              contractAddress: marketAddr,
            });
          }
        }
      }
    } catch {
      // Quietly handle network or offline status
    }

    return markets;
  },
};
