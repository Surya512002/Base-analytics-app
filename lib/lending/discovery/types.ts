import type { Address } from "viem";

export type DiscoveryProtocol =
  | "morpho"
  | "beefy"
  | "pendle"
  | "zkfi"
  | "aave"
  | "euler"
  | "moonwell"
  | "superform"
  | "aerodrome";

export type MarketType = "borrow" | "lend" | "stake";

export interface NormalizedMarketAsset {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  isStock: boolean;
  logo?: string;
}

export interface MarketOracleInfo {
  address?: Address;
  name: string;
  isVerified: boolean;
  type?: "chainlink" | "pyth" | "composite" | "unknown";
}

export interface NormalizedMarket {
  protocol: DiscoveryProtocol;
  protocolLabel: string;
  marketId: string;
  type: MarketType;
  supplyAsset: NormalizedMarketAsset;
  collateralAsset?: NormalizedMarketAsset;
  borrowAsset?: NormalizedMarketAsset;
  supplyApy: number; // Percentage e.g. 5.25
  borrowApr?: number; // Percentage e.g. 4.10
  stakingApr?: number; // Percentage e.g. 24.5
  maxLtv: number; // Percentage e.g. 75
  liquidityUsd: number; // Available liquidity in USD
  tvlUsd: number; // Total Value Locked in USD
  utilization: number; // Percentage e.g. 64.2
  oracle: MarketOracleInfo;
  canSupply: boolean;
  canBorrow: boolean;
  canUseAsCollateral: boolean;
  riskFlags: string[];
  sourceLink: string;
  lastUpdated: string; // ISO 8601
  status: "active" | "paused" | "cap_reached";
  badgeText?: string;
  contractAddress?: Address;
  morphoParams?: {
    loanToken: Address;
    collateralToken: Address;
    oracle: Address;
    irm: Address;
    lltv: bigint;
  };
}

export interface DiscoveryAdapter {
  protocol: DiscoveryProtocol;
  protocolLabel: string;
  discoverMarkets: (chainId: number) => Promise<NormalizedMarket[]>;
}

export interface ProtocolHealthStatus {
  protocol: DiscoveryProtocol;
  status: "ok" | "error" | "cached";
  error?: string;
  lastSuccessfulUpdate: string;
  marketCount: number;
}

export interface DiscoveryResult {
  markets: NormalizedMarket[];
  protocolStatus: Record<DiscoveryProtocol, ProtocolHealthStatus>;
  lastUpdated: string;
  cached: boolean;
}

export const DISCOVERY_SAFETY_CONFIG = {
  MIN_LIQUIDITY_USD: 5000,
  REQUIRE_KNOWN_ORACLE: true,
  CAP_WARNING_THRESHOLD_PCT: 95,
  CACHE_TTL_SECONDS: 300, // 5 minutes
};
