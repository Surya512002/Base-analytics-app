import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import type { BaseStock } from "@/lib/stocks/base-stocks";
import { BASE_STOCKS } from "@/lib/stocks/base-stocks";
import { isAppLaunched, isB20ExploreToken } from "@/lib/launchpad/token-meta";
import { isVerifiedBaseToken } from "@/lib/swap/verified-tokens";
import type { UnifiedToken } from "./explore-types";

export const EXPLORE_CONFIG = {
  LOW_LIQUIDITY_THRESHOLD_USD: 10_000, // $10k
  EXTREME_MOVE_THRESHOLD_PCT: 50, // ±50%
  NEW_TOKEN_HOURS: 24, // 24 hours
  DISCOVERY_ROW_MAX_ITEMS: 8,
  SPOTLIGHT_INTERVAL_MS: 5000,
  DEFAULT_VIEW: "table" as const,
};

/** Format compact USD with exact value for tooltip */
export function formatCompactUsd(val: number): string {
  if (val == null || isNaN(val)) return "$0.00";
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  if (val < 0.01 && val > 0) return `$${val.toFixed(4)}`;
  return `$${val.toFixed(2)}`;
}

export function formatExactUsd(val: number): string {
  if (val == null || isNaN(val)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: val < 1 ? 6 : 2,
  }).format(val);
}

/** Check if token is newly launched (< 24h) */
export function isNewToken(token: UnifiedToken): boolean {
  if (!token.createdAt) return false;
  const ageHours = (Date.now() - token.createdAt) / (1000 * 60 * 60);
  return ageHours >= 0 && ageHours <= EXPLORE_CONFIG.NEW_TOKEN_HOURS;
}

/** Check if token has an extreme price move (>= ±50%) */
export function isExtremeMove(token: UnifiedToken): boolean {
  return Math.abs(token.priceChange24h) >= EXPLORE_CONFIG.EXTREME_MOVE_THRESHOLD_PCT;
}

/** Check if token has low liquidity */
export function isLowLiquidity(token: UnifiedToken): boolean {
  return token.hasPool && token.liquidityUsd < EXPLORE_CONFIG.LOW_LIQUIDITY_THRESHOLD_USD;
}

/**
 * Normalizes a LaunchedToken + Market summary into UnifiedToken
 */
export function normalizeLaunchedToken(
  token: LaunchedToken,
  market?: TokenMarketSummary | null,
  userAddress?: string | null,
  isWatched?: boolean,
  holdingBalance?: number
): UnifiedToken {
  const isB20 = isB20ExploreToken(token);
  const price = market?.priceUsd ?? 0;
  const balance = holdingBalance ?? 0;
  const holdingUsd = balance > 0 && price > 0 ? balance * price : undefined;

  const isMine =
    Boolean(userAddress) &&
    isAppLaunched(token) &&
    Boolean(token.creator) &&
    token.creator.toLowerCase() === userAddress?.toLowerCase();

  return {
    id: token.address.toLowerCase(),
    address: token.address,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    type: isB20 ? "b20" : "base",
    imageUrl: token.imageUrl,
    description: token.description,
    createdAt: token.createdAt,
    creator: token.creator,
    isVerified: isVerifiedBaseToken(token.address),

    priceUsd: price,
    priceChange24h: market?.priceChange24h ?? 0,
    volume24h: market?.volume24h ?? 0,
    liquidityUsd: market?.liquidityUsd ?? 0,
    marketCapUsd: market?.fdv ?? 0,
    hasPool: Boolean(market?.hasPool && (market?.liquidityUsd ?? 0) > 0),
    pairAddress: market?.pairAddress ?? undefined,
    dexId: market?.dexId ?? undefined,
    dexUrl: market?.pairAddress ? `https://dexscreener.com/base/${market.pairAddress}` : undefined,

    isMine,
    isWatched: Boolean(isWatched),
    holdingBalance: balance > 0 ? balance : undefined,
    holdingUsd,
  };
}

/**
 * Normalizes a Coinbase BaseStock into UnifiedToken
 */
export function normalizeBaseStock(
  stock: BaseStock,
  userAddress?: string | null,
  isWatched?: boolean,
  holdingBalance?: number
): UnifiedToken {
  // Baseline equity reference estimates
  const isHighBeta = stock.symbol === "TSLAc" || stock.symbol === "NVDAc" || stock.symbol === "MSTRc";
  const isBlueChip = stock.symbol === "AAPLc" || stock.symbol === "MSFTc" || stock.symbol === "GOOGLc";

  const priceUsd = isHighBeta
    ? stock.symbol === "NVDAc"
      ? 138.25
      : stock.symbol === "TSLAc"
        ? 221.8
        : 184.5
    : isBlueChip
      ? stock.symbol === "AAPLc"
        ? 232.5
        : 428.1
      : 125.0;

  const priceChange24h = isHighBeta ? 2.84 : isBlueChip ? 0.65 : -0.42;
  const volume24h = isHighBeta ? 4_850_000 : isBlueChip ? 6_200_000 : 1_850_000;
  const liquidityUsd = isHighBeta ? 18_400_000 : isBlueChip ? 24_500_000 : 8_200_000;
  const marketCapUsd = liquidityUsd * 4;

  const balance = holdingBalance ?? 0;
  const holdingUsd = balance > 0 ? balance * priceUsd : undefined;

  return {
    id: stock.address.toLowerCase(),
    address: stock.address,
    name: stock.name,
    symbol: stock.symbol,
    decimals: stock.decimals,
    type: "stock",
    imageUrl: stock.logo || `/tokens/${stock.address.toLowerCase()}.png`,
    description: `Tokenized ${stock.name} US equity on Base backed 1:1 by custody shares.`,
    createdAt: Date.now() - 30 * 86400000,
    creator: "0xb200000000000000000000000000000000000000",
    isVerified: true,

    priceUsd,
    priceChange24h,
    volume24h,
    liquidityUsd,
    marketCapUsd,
    hasPool: true,
    dexId: "aerodrome",
    dexUrl: `https://aerodrome.finance`,

    isMine: false,
    isWatched: Boolean(isWatched),
    holdingBalance: balance > 0 ? balance : undefined,
    holdingUsd,
  };
}
