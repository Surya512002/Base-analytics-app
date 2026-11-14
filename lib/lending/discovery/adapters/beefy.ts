import { getAddress, type Address } from "viem";
import type { DiscoveryAdapter, NormalizedMarket } from "../types";
import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";

const BEEFY_VAULTS_URL = "https://api.beefy.finance/vaults";
const BEEFY_APY_URL = "https://api.beefy.finance/apy";
const BEEFY_TVL_URL = "https://api.beefy.finance/tvl";
/** Beefy's own symbol -> contract map for Base: lets us verify vault assets by ADDRESS. */
const BEEFY_TOKENS_URL = "https://api.beefy.finance/tokens/base";

/**
 * The official stock a Beefy vault holds, matched by contract address only (never by
 * ticker: "VVV", "CAKE", "PLAY", "COMP" are crypto tokens that share stock tickers).
 */
export function beefyVaultStock(
  vault: { assets?: string[]; tokenAddress?: string },
  tokenAddressBySymbol: Record<string, string | undefined>,
  officialByAddress: Map<string, (typeof TOKENIZED_STOCKS_REGISTRY)[number]>
) {
  const addrs = [
    vault.tokenAddress,
    ...(Array.isArray(vault.assets) ? vault.assets.map((sym) => tokenAddressBySymbol[sym]) : []),
  ]
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.toLowerCase());
  for (const a of addrs) {
    const hit = officialByAddress.get(a);
    if (hit) return hit;
  }
  return null;
}

export const beefyAdapter: DiscoveryAdapter = {
  protocol: "beefy",
  protocolLabel: "Beefy Finance",
  async discoverMarkets(chainId: number): Promise<NormalizedMarket[]> {
    if (chainId !== 8453) return [];

    const markets: NormalizedMarket[] = [];

    try {
      const [vaultsRes, apyRes, tvlRes, tokensRes] = await Promise.all([
        fetch(BEEFY_VAULTS_URL, { next: { revalidate: 300 } }),
        fetch(BEEFY_APY_URL, { next: { revalidate: 300 } }).catch(() => null),
        fetch(BEEFY_TVL_URL, { next: { revalidate: 300 } }).catch(() => null),
        fetch(BEEFY_TOKENS_URL, { next: { revalidate: 3600 } }).catch(() => null),
      ]);

      if (!vaultsRes.ok) {
        console.warn(`[Beefy Adapter] Failed to fetch vaults: HTTP ${vaultsRes.status}`);
        return [];
      }

      const allVaults = (await vaultsRes.json()) as any[];
      const apyMap = apyRes && apyRes.ok ? ((await apyRes.json()) as Record<string, number>) : {};
      const tvlMap = tvlRes && tvlRes.ok ? ((await tvlRes.json()) as Record<string, any>) : {};
      const tokensJson =
        tokensRes && tokensRes.ok ? ((await tokensRes.json()) as Record<string, { address?: string }>) : {};
      const tokenAddressBySymbol: Record<string, string | undefined> = {};
      for (const [sym, t] of Object.entries(tokensJson)) tokenAddressBySymbol[sym] = t?.address;
      const officialByAddress = new Map(TOKENIZED_STOCKS_REGISTRY.map((st) => [st.address.toLowerCase(), st]));

      const baseVaults = allVaults.filter(
        (v) => (v.chain === "base" || v.network === "base") && v.status === "active"
      );

      // Sort candidate vaults: active vaults first, then highest TVL descending
      baseVaults.sort((a, b) => {
        const aActive = a.status === "active";
        const bActive = b.status === "active";
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        const aTvl = (tvlMap[8453]?.[a.id] ?? tvlMap[a.id]) || 0;
        const bTvl = (tvlMap[8453]?.[b.id] ?? tvlMap[b.id]) || 0;
        return Number(bTvl) - Number(aTvl);
      });

      const seenStocks = new Set<string>();

      for (const v of baseVaults) {
        if (!v.earnContractAddress) continue;

        const matchedStock = beefyVaultStock(v, tokenAddressBySymbol, officialByAddress);
        if (!matchedStock) continue;

        if (seenStocks.has(v.id)) continue;
        seenStocks.add(v.id);
        // Single-asset vault that lends the stock itself (e.g. Beefy's Aave v4 vaults)
        const singleAsset = (v.tokenAddress || "").toLowerCase() === matchedStock.address.toLowerCase();
        const venue = String(v.platformId || "").toLowerCase();

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
              symbol: singleAsset ? matchedStock.symbol : v.token || `${matchedStock.symbol}-USDC`,
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
              name: singleAsset ? `Beefy vault on ${venue || "lending"}` : "Beefy / Aerodrome LP Oracle",
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
            badgeText: singleAsset
              ? venue.startsWith("aave")
                ? "Lends your stock on Aave v4"
                : "Single-stock vault"
              : "Auto-compounding LP",
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
