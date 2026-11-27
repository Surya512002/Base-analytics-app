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
    isVerified: isVerifiedBaseToken(token.address, { liquidityUsd: market?.liquidityUsd }),

    priceUsd: price,
    priceChange24h: market?.priceChange24h ?? 0,
    volume24h: market?.volume24h ?? 0,
    liquidityUsd: market?.liquidityUsd ?? 0,
    marketCapUsd: market?.fdv ?? 0,
    buys24h: market?.buys24h ?? undefined,
    sells24h: market?.sells24h ?? undefined,
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
 * Normalizes a Coinbase BaseStock into UnifiedToken, with real market data from the stock's
 * Base pools (DexScreener). Without market data the numbers are 0 and `hasPool` is false, so
 * the stock is listed but not ranked in volume/mover rows; nothing is estimated.
 */
export function normalizeBaseStock(
  stock: BaseStock,
  userAddress?: string | null,
  isWatched?: boolean,
  holdingBalance?: number,
  market?: TokenMarketSummary | null
): UnifiedToken {
  const priceUsd = market?.priceUsd ?? 0;
  const priceChange24h = market?.priceChange24h ?? 0;
  const volume24h = market?.volume24h ?? 0;
  const liquidityUsd = market?.liquidityUsd ?? 0;
  const marketCapUsd = market?.marketCap ?? market?.fdv ?? 0;
  const hasPool = Boolean(market?.hasPool && liquidityUsd > 0);

  const balance = holdingBalance ?? 0;
  const holdingUsd = balance > 0 && priceUsd > 0 ? balance * priceUsd : undefined;

  return {
    id: stock.address.toLowerCase(),
    address: stock.address,
    name: stock.name,
    symbol: stock.symbol,
    decimals: stock.decimals,
    type: "stock",
    imageUrl: stock.logo || `/tokens/${stock.address.toLowerCase()}.png`,
    description: `Tokenized ${stock.name} US equity on Base backed by shares held in custody.`,
    createdAt: (stock.addedAt && Date.parse(stock.addedAt)) || 0,
    creator: "0xb200000000000000000000000000000000000000",
    isVerified: true,

    priceUsd,
    priceChange24h,
    volume24h,
    liquidityUsd,
    marketCapUsd,
    hasPool,
    pairAddress: market?.pairAddress ?? undefined,
    dexId: market?.dexId ?? undefined,
    dexUrl: market?.pairAddress ? `https://dexscreener.com/base/${market.pairAddress}` : undefined,

    isMine: false,
    isWatched: Boolean(isWatched),
    holdingBalance: balance > 0 ? balance : undefined,
    holdingUsd,
  };
}
