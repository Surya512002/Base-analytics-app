import { getAddress, type Address } from "viem";
import type { DiscoveryAdapter, NormalizedMarket } from "../types";
import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";

const BEEFY_VAULTS_URL = "https://api.beefy.finance/vaults";
const BEEFY_APY_URL = "https://api.beefy.finance/apy";
const BEEFY_TVL_URL = "https://api.beefy.finance/tvl";

export const beefyAdapter: DiscoveryAdapter = {
  protocol: "beefy",
  protocolLabel: "Beefy Finance",
  async discoverMarkets(chainId: number): Promise<NormalizedMarket[]> {
    if (chainId !== 8453) return [];

    const markets: NormalizedMarket[] = [];

    try {
      const [vaultsRes, apyRes, tvlRes] = await Promise.all([
        fetch(BEEFY_VAULTS_URL, { next: { revalidate: 300 } }),
        fetch(BEEFY_APY_URL, { next: { revalidate: 300 } }).catch(() => null),
        fetch(BEEFY_TVL_URL, { next: { revalidate: 300 } }).catch(() => null),
      ]);

      if (!vaultsRes.ok) {
        console.warn(`[Beefy Adapter] Failed to fetch vaults: HTTP ${vaultsRes.status}`);
        return [];
      }

      const allVaults = (await vaultsRes.json()) as any[];
      const apyMap = apyRes && apyRes.ok ? ((await apyRes.json()) as Record<string, number>) : {};
      const tvlMap = tvlRes && tvlRes.ok ? ((await tvlRes.json()) as Record<string, any>) : {};

      const baseVaults = allVaults.filter(
        (v) => v.chain === "base" || v.network === "base"
      );

      for (const v of baseVaults) {
        if (!v.earnContractAddress) continue;

        const rawAssets: string[] = Array.isArray(v.assets) ? v.assets : [];
        const tokenParts = (v.token || "").toLowerCase().split(/[-_]/);
        const idParts = (v.id || "").toLowerCase().split(/[-_]/);
        const assetsLower = rawAssets.map((a) => a.toLowerCase());

        // Match against tokenized stocks registry strictly
        const matchedStock = TOKENIZED_STOCKS_REGISTRY.find((stock) => {
          const sym = stock.symbol.toLowerCase();
          const ticker = stock.underlyingTicker.toLowerCase();
          if (ticker.length <= 2) {
            return (
              assetsLower.includes(sym) ||
              assetsLower.includes(ticker) ||
              tokenParts.includes(sym) ||
              tokenParts.includes(ticker)
            );
          }
          return (
            assetsLower.includes(sym) ||
            assetsLower.includes(ticker) ||
            tokenParts.includes(sym) ||
            tokenParts.includes(ticker) ||
            idParts.includes(sym)
          );
        });

        if (!matchedStock) continue;

        try {
          const earnAddr = getAddress(v.earnContractAddress);
          const rawApy = apyMap[v.id] ? Number(apyMap[v.id]) * 100 : 0;
          const supplyApy = Math.round(rawApy * 100) / 100;

          const tvlVal = tvlMap[8453]?.[v.id] ?? tvlMap[v.id] ?? 0;
          const tvlUsd = Math.round(Number(tvlVal) || 0);
          const liquidityUsd = tvlUsd;

          const isPaused = v.status === "paused" || v.status === "eol";
          const status = isPaused ? "paused" : "active";

          markets.push({
            protocol: "beefy",
            protocolLabel: "Beefy Finance",
            marketId: `beefy-${v.id}`,
            type: "stake",
            supplyAsset: {
              symbol: v.token || `${matchedStock.symbol}-USDC`,
              name: v.name || `${matchedStock.name} Beefy Vault`,
              address: earnAddr,
              decimals: v.tokenDecimals || 18,
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
            supplyApy,
            maxLtv: 0,
            liquidityUsd,
            tvlUsd,
            utilization: 100,
            oracle: {
              name: "Beefy / Aerodrome LP Oracle",
              isVerified: true,
              type: "composite",
            },
            canSupply: !isPaused,
            canBorrow: false,
            canUseAsCollateral: false,
            riskFlags: isPaused ? ["PAUSED_VAULT"] : [],
            sourceLink: `https://app.beefy.com/vault/${v.id}`,
            lastUpdated: new Date().toISOString(),
            status,
            badgeText: v.status === "active" ? "Beefy Auto-Compounder" : "Beefy Vault (Paused)",
            contractAddress: earnAddr,
          });
        } catch (mktErr) {
          console.warn(`[Beefy Adapter] Skipping invalid vault ${v.id}:`, mktErr);
        }
      }
    } catch (err) {
      console.error("[Beefy Adapter] Discovery failed:", err);
    }

    return markets;
  },
};
