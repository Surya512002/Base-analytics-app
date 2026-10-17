export type MarketProtocol =
  | "morpho"
  | "aerodrome"
  | "moonwell"
  | "aave"
  | "superform"
  | "dinari"
  | "ondo";

export type MarketCategory =
  | "stocks_borrow" // Borrow cash/crypto against tokenized stock collateral
  | "stocks_lend"   // Lend tokenized stocks to earn securities lending yield
  | "stocks_stake"  // Stake tokenized stock LP/gauges/dividends
  | "crypto_lend"   // Supply USDC, WETH, cbBTC
  | "crypto_borrow" // Borrow USDC, WETH, cbBTC
  | "crypto_stake";  // Liquid staking & DEX gauge staking

export interface MarketAsset {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  isStock?: boolean;
  icon?: string;
}

export interface LendingMarket {
  id: string;
  name: string;
  protocol: MarketProtocol;
  protocolLabel: string;
  protocolBadge: string;
  protocolAddress: `0x${string}`;
  protocolUrl: string;
  category: MarketCategory;
  asset: MarketAsset;
  collateralAsset?: MarketAsset;
  supplyApy: number; // Percent e.g. 4.85
  borrowApr?: number; // Percent e.g. 3.25
  stakingApr?: number; // Percent e.g. 28.5
  tvlUsd: number;
  ltv?: number; // Max Loan to Value % e.g. 75
  liquidationThreshold?: number; // e.g. 80
  utilization?: number; // % e.g. 64.2
  oracle: string;
  contractAddress: `0x${string}`;
  contractType:
    | "morpho_vault"
    | "morpho_blue"
    | "aerodrome_gauge"
    | "moonwell_mtoken"
    | "aave_v3"
    | "superform_vault";
  builderAttributed: boolean;
  badgeText?: string;
  description?: string;
  isStockFocus: boolean;
  morphoParams?: MorphoMarketParams;
  marketId?: `0x${string}`;
  availableLiquidityUsd?: number;
  oracleStatus?: "active" | "paused";
  lltvPct?: number;
}

export interface MorphoMarketParams {
  loanToken: `0x${string}`;
  collateralToken: `0x${string}`;
  oracle: `0x${string}`;
  irm: `0x${string}`;
  lltv: bigint;
}

export type ActionModalType = "supply" | "borrow" | "repay" | "withdraw" | "stake" | "unstake";

export interface UserMarketPosition {
  marketId: string;
  suppliedAmount: string;
  suppliedUsd: number;
  borrowedAmount: string;
  borrowedUsd: number;
  stakedAmount: string;
  stakedUsd: number;
  accruedRewardsUsd: number;
  healthFactor?: number;
}

export interface UserMorphoPosition {
  marketId: `0x${string}`;
  marketName: string;
  collateralSymbol: string;
  loanSymbol: string;
  collateralAmount: bigint;
  collateralFormatted: string;
  collateralUsd: number;
  borrowedAmount: bigint;
  borrowedFormatted: string;
  borrowedUsd: number;
  suppliedLoanAmount?: bigint;
  suppliedLoanUsd?: number;
  healthFactor: number;
  lltvPct: number;
  currentLtvPct: number;
  availableBorrowUsd: number;
  oracleStatus: "active" | "paused";
  isHealthy: boolean;
}

export type {
  UserStockPortfolioSummary,
  UserStockPortfolioPosition,
} from "./unified-comparison";
