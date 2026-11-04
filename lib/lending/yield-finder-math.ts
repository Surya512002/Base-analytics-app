/**
 * Yield Finder Filtering, Risk Tiering, and Sorting Engine
 * Aggregates verified Base yield pools (Aerodrome, Beefy, Morpho, Moonwell)
 * Zero mock numbers — displays live or unavailable APY.
 */

export type RiskTier = "low" | "moderate" | "degen";
export type AssetCategory = "all" | "usdc" | "eth" | "stocks";

export interface UnifiedYieldPool {
  id: string;
  name: string;
  assetSymbol: string;
  protocol: "aerodrome" | "beefy" | "morpho" | "moonwell" | "aave" | "ipor";
  protocolLabel: string;
  apy: number | null; // Net APY in %
  tvlUsd: number | null;
  riskTier: RiskTier;
  riskReason: string;
  contractAddress: string;
  actionType: "supply" | "stake" | "vault";
  isStock: boolean;
}

export interface YieldFinderFilterParams {
  assetCategory?: AssetCategory;
  riskTier?: RiskTier | "all";
  minTvlUsd?: number;
  sortBy?: "apy_desc" | "tvl_desc" | "risk_asc" | "protocol";
  searchQuery?: string;
}

/**
 * Assigns risk tier and reason based on protocol and asset characteristics.
 */
export function determineYieldRiskTier(params: {
  protocol: string;
  isStock: boolean;
  assetSymbol: string;
}): { riskTier: RiskTier; riskReason: string } {
  const { protocol, isStock, assetSymbol } = params;
  const p = protocol.toLowerCase();
  const sym = assetSymbol.toUpperCase();

  if (p === "moonwell" || p === "aave") {
    if (sym.includes("USDC") || sym.includes("ETH")) {
      return {
        riskTier: "low",
        riskReason: "Battle-tested overcollateralized lending pool",
      };
    }
  }

  if (p === "morpho" || p === "morpho_blue") {
    return {
      riskTier: "low",
      riskReason: "Isolated risk lending market with transparent LLTV",
    };
  }

  if (p === "beefy") {
    return {
      riskTier: isStock ? "moderate" : "low",
      riskReason: isStock
        ? "Auto-compounding vault over tokenized equity pair"
        : "Automated compounder on deep Base liquidity pool",
    };
  }

  if (p === "aerodrome") {
    if (isStock) {
      return {
        riskTier: "moderate",
        riskReason: "Concentrated liquidity gauge subject to stock market hours",
      };
    }
    return {
      riskTier: "moderate",
      riskReason: "DEX liquidity pool subject to impermanent loss",
    };
  }

  return {
    riskTier: "degen",
    riskReason: "Experimental or volatile yield strategy",
  };
}

/**
 * Filters and sorts unified yield pools.
 */
export function filterAndSortYieldPools(
  pools: UnifiedYieldPool[],
  params: YieldFinderFilterParams = {}
): UnifiedYieldPool[] {
  const {
    assetCategory = "all",
    riskTier = "all",
    minTvlUsd = 0,
    sortBy = "apy_desc",
    searchQuery = "",
  } = params;

  const query = searchQuery.trim().toLowerCase();

  return pools
    .filter((pool) => {
      // 1. Asset Category
      if (assetCategory === "usdc") {
        if (!pool.assetSymbol.toLowerCase().includes("usdc") && !pool.name.toLowerCase().includes("usdc")) {
          return false;
        }
      } else if (assetCategory === "eth") {
        if (!pool.assetSymbol.toLowerCase().includes("eth") && !pool.name.toLowerCase().includes("eth")) {
          return false;
        }
      } else if (assetCategory === "stocks") {
        if (!pool.isStock && !pool.assetSymbol.endsWith("c")) {
          return false;
        }
      }

      // 2. Risk Tier
      if (riskTier !== "all" && pool.riskTier !== riskTier) {
        return false;
      }

      // 3. Minimum TVL
      if (minTvlUsd > 0 && (pool.tvlUsd === null || pool.tvlUsd < minTvlUsd)) {
        return false;
      }

      // 4. Search Query
      if (query) {
        const matchesName = pool.name.toLowerCase().includes(query);
        const matchesSymbol = pool.assetSymbol.toLowerCase().includes(query);
        const matchesProtocol = pool.protocolLabel.toLowerCase().includes(query);
        if (!matchesName && !matchesSymbol && !matchesProtocol) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "apy_desc": {
          const apyA = a.apy ?? -1;
          const apyB = b.apy ?? -1;
          return apyB - apyA;
        }
        case "tvl_desc": {
          const tvlA = a.tvlUsd ?? -1;
          const tvlB = b.tvlUsd ?? -1;
          return tvlB - tvlA;
        }
        case "risk_asc": {
          const riskRank = { low: 1, moderate: 2, degen: 3 };
          return riskRank[a.riskTier] - riskRank[b.riskTier];
        }
        case "protocol":
          return a.protocolLabel.localeCompare(b.protocolLabel);
        default:
          return 0;
      }
    });
}
