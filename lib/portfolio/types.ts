import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";

export type PriceSource = "chainlink" | "defillama" | "dexscreener" | "pegged" | "none";

export interface PortfolioToken {
  address: `0x${string}` | null; // null for native ETH
  symbol: string;
  name: string;
  decimals: number;
  balanceRaw: string; // BigInt serialized as string
  balanceFormatted: string; // Human readable formatted balance
  balance: number; // Float for backward-compatibility with TokenSelectorModal and sorting
  balanceNumber: number; // Float for calculations
  priceUsd: number | null; // null if unpriced
  priceSource: PriceSource;
  usdValue: number; // 0 if unpriced, otherwise balance * priceUsd
  priceChange24h: number | null; // 24h percentage change
  logo: string | null;
  isSpam: boolean;
  spamReason?: string;
  isVerified: boolean;
  isStock: boolean;
  isB20: boolean;
  isCustom?: boolean;
  hasTradeRoute: boolean;
  counter: SwapCounter;
}

export type TokenHolding = PortfolioToken;

export interface DefiPositionSummary {
  protocol: string;
  assetSymbol: string;
  type: "supplied" | "borrowed" | "staked";
  amountFormatted: string;
  usdValue: number;
}

export interface DefiPortfolioBreakdown {
  totalSuppliedUsd: number;
  totalBorrowedUsd: number;
  netUsd: number;
  positionsCount: number;
  positions: DefiPositionSummary[];
}

export interface PortfolioResponse {
  address: `0x${string}`;
  chainId: 8453;
  chainName: "Base";
  tokens: PortfolioToken[];
  totalUsd: number; // Sum of priced tokens
  pricedCount: number;
  unpricedCount: number;
  spamCount: number;
  dustCount: number;
  totalCount: number;
  defi?: DefiPortfolioBreakdown;
  updatedAt: number;
  partial: boolean;
  warning?: string;
}
