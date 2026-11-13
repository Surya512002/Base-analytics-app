/**
 * Launch pricing helpers: starting market-cap presets and a first-buy estimate against the
 * seeded pool (constant-product, before the pool fee). Pure functions, no network calls.
 */
import { DEFAULT_STARTING_PRICE_USD } from "@/lib/launchpad/launch-configs";
import { FIXED_LAUNCH_SUPPLY } from "@/lib/launchpad/launch-config";

export const LAUNCH_SUPPLY = Number(FIXED_LAUNCH_SUPPLY);

/**
 * Opening market caps. The first is today's default (the lowest), so every other choice
 * needs fewer tokens to pair with the same ETH seed: it can never ask for more than before.
 */
export const START_CAP_PRESETS: ReadonlyArray<{ id: string; capUsd: number; priceUsd: string }> = [
  { id: "default", capUsd: parseFloat(DEFAULT_STARTING_PRICE_USD) * LAUNCH_SUPPLY, priceUsd: DEFAULT_STARTING_PRICE_USD },
  { id: "10k", capUsd: 10_000, priceUsd: "0.00001" },
  { id: "25k", capUsd: 25_000, priceUsd: "0.000025" },
  { id: "100k", capUsd: 100_000, priceUsd: "0.0001" },
];

export const FIRST_BUY_PRESETS = ["0.01", "0.05", "0.1", "0.25"] as const;

export type FirstBuyEstimate = {
  tokens: number;
  pctOfSupply: number;
  /** How much the buy moves the price, in % (100 = price doubles). */
  priceImpactPct: number;
  marketCapAfterUsd: number;
  /** Share of the pooled tokens this buy takes (0..1). */
  poolTaken: number;
};

/**
 * Tokens out for `buyEth` into a pool seeded with `seedEth` at `startPriceUsd`.
 * `pools` = how many pools the seed is split across (the "both" venue splits 50/50; a buy
 * routes through one of them). Returns null when there's no seeded pool to estimate from.
 */
export function estimateFirstBuy(params: {
  buyEth: number;
  seedEth: number;
  startPriceUsd: number;
  ethUsd: number;
  pools?: number;
  supply?: number;
}): FirstBuyEstimate | null {
  const { buyEth, startPriceUsd, ethUsd } = params;
  const supply = params.supply ?? LAUNCH_SUPPLY;
  const pools = Math.max(1, params.pools ?? 1);
  const seedEth = params.seedEth / pools;
  if (!(buyEth > 0) || !(seedEth > 0) || !(startPriceUsd > 0) || !(ethUsd > 0)) return null;

  const priceEth = startPriceUsd / ethUsd;
  const poolTokens = seedEth / priceEth;
  const k = seedEth * poolTokens;
  const tokensOut = poolTokens - k / (seedEth + buyEth);
  const ethAfter = seedEth + buyEth;
  const tokensAfter = poolTokens - tokensOut;
  const priceAfterEth = ethAfter / tokensAfter;

  return {
    tokens: tokensOut,
    pctOfSupply: (tokensOut / supply) * 100,
    priceImpactPct: (priceAfterEth / priceEth - 1) * 100,
    marketCapAfterUsd: priceAfterEth * ethUsd * supply,
    poolTaken: tokensOut / poolTokens,
  };
}

/** Tokens the ETH seed pairs with at the starting price (what goes into the pool). */
export function seedTokensFor(seedEth: number, startPriceUsd: number, ethUsd: number): number {
  if (!(seedEth > 0) || !(startPriceUsd > 0) || !(ethUsd > 0)) return 0;
  return seedEth / (startPriceUsd / ethUsd);
}

export function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(n < 10 ? 2 : 0);
}

export function compactUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  return `$${compactNumber(n)}`;
}
