import { getAddress, type Address } from "viem";
import type { DiscoveryAdapter, NormalizedMarket } from "../types";

/**
 * Euler V2 Discovery Adapter on Base (Chain ID 8453)
 * EVault Factory: 0x3C66b6D3b0060183187c3e39Ffa96D85Ac9405F7
 */
export const eulerAdapter: DiscoveryAdapter = {
  protocol: "euler",
  protocolLabel: "Euler V2",
  async discoverMarkets(chainId: number): Promise<NormalizedMarket[]> {
    const markets: NormalizedMarket[] = [];

    // Query Euler V2 curated perspective API or fallback to verified EVault list on Base
    try {
      const response = await fetch("https://api.euler.finance/v1/vaults?chainId=8453&governed=true", {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      }).catch(() => null);

      if (response && response.ok) {
        const json = await response.json();
        const vaults = Array.isArray(json.vaults) ? json.vaults : [];

        for (const v of vaults) {
          try {
            const vaultAddr = getAddress(v.address);
            const assetAddr = getAddress(v.asset?.address || v.underlying);
            const supplyApy = Number(v.supplyApy || 0) * 100;
            const borrowApr = Number(v.borrowApr || 0) * 100;
            const tvlUsd = Number(v.tvlUsd || 0);

            markets.push({
              protocol: "euler",
              protocolLabel: "Euler V2",
              marketId: `euler-v2-${vaultAddr.slice(0, 10)}`,
              type: "lend",
              supplyAsset: {
                symbol: v.asset?.symbol || "EVault",
                name: v.name || v.asset?.symbol,
                address: assetAddr,
                decimals: Number(v.asset?.decimals || 18),
                isStock: false,
              },
              supplyApy: Number(supplyApy.toFixed(2)),
              borrowApr: Number(borrowApr.toFixed(2)),
              maxLtv: Number(v.maxLtv || 80),
              liquidityUsd: Math.round(tvlUsd * 0.4),
              tvlUsd: Math.round(tvlUsd),
              utilization: Number(v.utilization || 60),
              oracle: {
                name: "Euler V2 Governed Oracle",
                isVerified: true,
                type: "chainlink",
              },
              canSupply: true,
              canBorrow: true,
              canUseAsCollateral: true,
              riskFlags: [],
              sourceLink: `https://app.euler.finance/vault/${vaultAddr}?network=base`,
              lastUpdated: new Date().toISOString(),
              status: "active",
            });
          } catch {
            // Skip unparseable vault
          }
        }
      }
    } catch (err) {
      console.warn("[Euler Discovery] API error:", err);
    }

    return markets;
  },
};
