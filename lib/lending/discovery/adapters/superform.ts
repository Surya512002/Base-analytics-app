import { getAddress, type Address } from "viem";
import type { DiscoveryAdapter, NormalizedMarket } from "../types";
import { SUPERFORM_ROUTER_BASE } from "@/lib/lending/constants";

/**
 * Superform Protocol Adapter on Base (Chain ID 8453)
 * Superform Router: 0x8e5f31ae56b19d4b4a3c20054a86f9e6144e1d5a
 */
export const superformAdapter: DiscoveryAdapter = {
  protocol: "superform",
  protocolLabel: "Superform",
  async discoverMarkets(chainId: number): Promise<NormalizedMarket[]> {
    const markets: NormalizedMarket[] = [];

    try {
      const response = await fetch("https://api.superform.xyz/v1/vaults?chainId=8453", {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      }).catch(() => null);

      if (response && response.ok) {
        const json = await response.json();
        const vaults = Array.isArray(json.data) ? json.data : [];

        for (const v of vaults) {
          try {
            const vaultAddr = getAddress(v.vaultAddress || v.address);
            const assetAddr = getAddress(v.assetAddress || v.underlyingAddress);
            const tvlUsd = Number(v.tvlUsd || 0);
            const apy = Number(v.netApy || v.apy || 0);

            markets.push({
              protocol: "superform",
              protocolLabel: "Superform SuperVault",
              marketId: `superform-${vaultAddr.slice(0, 10)}`,
              type: "stake",
              supplyAsset: {
                symbol: v.symbol || "svAsset",
                name: v.name || "Superform Vault",
                address: assetAddr,
                decimals: Number(v.decimals || 18),
                isStock: false,
              },
              supplyApy: Number(apy.toFixed(2)),
              stakingApr: Number(apy.toFixed(2)),
              maxLtv: 0,
              liquidityUsd: Math.round(tvlUsd * 0.5),
              tvlUsd: Math.round(tvlUsd),
              utilization: 100,
              oracle: {
                name: "Superform Oracle Hub",
                isVerified: true,
                type: "composite",
              },
              canSupply: true,
              canBorrow: false,
              canUseAsCollateral: false,
              riskFlags: [],
              sourceLink: `https://app.superform.xyz/vault/${vaultAddr}`,
              lastUpdated: new Date().toISOString(),
              status: "active",
            });
          } catch {
            // Skip unparseable item
          }
        }
      }
    } catch (err) {
      console.warn("[Superform Discovery] API error:", err);
    }

    return markets;
  },
};
