import { z } from "zod";
import type { Address } from "viem";

export const PricePointSchema = z.object({
  date: z.string(),
  value: z.number(),
  breakOnMissingDays: z.boolean().optional(),
});

export type PricePoint = z.infer<typeof PricePointSchema>;

export const StockMarketItemSchema = z.object({
  symbol: z.string(),
  underlyingTicker: z.string(),
  name: z.string(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  decimals: z.number().default(8),
  price: z.number(),
  change24h: z.number(),
  tradingLiquidity: z.number(),
  priceImpact10k: z.number().nullable(),
  usedAsCollateral: z.number().nullable(),
  appVolumes: z.record(z.string(), z.number()).default({}),
  category: z.string().default("tech"),
  prospectusUrl: z.string().optional(),
  priceWeek: z.array(PricePointSchema).default([]),
  status: z.enum(["active", "paused", "deprecated", "pending"]).default("active"),
  lastUpdated: z.string(),
});

export type StockMarketItem = z.infer<typeof StockMarketItemSchema> & {
  address: Address;
};

export const ChartRangeSchema = z.object({
  label: z.enum(["1M", "3M", "All"]),
  days: z.number().nullable(),
});

export type ChartRange = z.infer<typeof ChartRangeSchema>;

export const ActivitySeriesSchema = z.object({
  label: z.string(),
  info: z.string().optional(),
  flowLabel: z.string().optional(),
  points: z.array(PricePointSchema),
  ranges: z.array(ChartRangeSchema),
  hideChange: z.boolean().optional(),
});

export type ActivitySeries = z.infer<typeof ActivitySeriesSchema>;

export const MarketsOverviewSchema = z.object({
  volume24h: z.number(),
  totalSupplied: z.number(),
  totalBorrowed: z.number(),
  series: z.array(ActivitySeriesSchema),
  dataAsOf: z.string(),
  isStale: z.boolean().default(false),
});

export type MarketsOverview = z.infer<typeof MarketsOverviewSchema>;

export type ImpactSafetyTier = "safe" | "moderate" | "high" | "critical";

export interface ImpactSafetyResult {
  impactPct: number;
  tier: ImpactSafetyTier;
  action: "allow" | "warn" | "block";
  badgeColorClass: string;
  badgeLabel: string;
  title: string;
  message: string;
  suggestion: string | null;
}

export interface TradeVenue {
  name: string;
  description: string;
  url: string;
  logo: string;
}

export const OFFICIAL_TRADE_VENUES: readonly TradeVenue[] = [
  {
    name: "Coinbase Wallet",
    description: "Trade directly in your smart wallet with zero gas or subsidised execution.",
    url: "https://wallet.coinbase.com",
    logo: "https://metadata.coinbase.com/equity_icons/coinbase-wallet.png",
  },
  {
    name: "Aerodrome Finance",
    description: "Central liquidity hub on Base with deep Slipstream concentrated pools.",
    url: "https://aerodrome.finance",
    logo: "/tokens/0x4200000000000000000000000000000000000006.png",
  },
  {
    name: "Matcha (0x)",
    description: "DEX aggregator routing across all Base liquidity pools with MEV protection.",
    url: "https://matcha.xyz",
    logo: "/tokens/matcha.png",
  },
  {
    name: "1inch Network",
    description: "Leading multi-DEX aggregator optimizing routes and split swaps on Base.",
    url: "https://1inch.io",
    logo: "/tokens/1inch.png",
  },
  {
    name: "CoW Swap",
    description: "MEV-protected batch auctions preventing frontrunning and sandwich attacks.",
    url: "https://swap.cow.fi",
    logo: "/tokens/cow.png",
  },
  {
    name: "Jumper Exchange",
    description: "Multi-chain and multi-venue liquidity routing powered by LI.FI.",
    url: "https://jumper.exchange",
    logo: "/tokens/jumper.png",
  },
] as const;

export function formatUsdLarge(val: number | null | undefined): string {
  if (val == null || !Number.isFinite(val) || val <= 0) return "—";
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}
