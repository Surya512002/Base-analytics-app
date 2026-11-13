import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";

/** One row on the Launch board: a launched token, its 24h market, and its launch facts. */
export type LaunchBoardRow = {
  address: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  createdAt: number;
  quoteAsset?: string;
  liquidityLocked?: boolean;
  creatorFeeBps?: number;
  antiSnipeBlocks?: number;
  priceUsd: number | null;
  marketCap: number | null;
  volume24h: number;
  priceChange24h: number | null;
  buys24h: number;
  sells24h: number;
  hasPool: boolean;
};

export type LaunchBoardStats = {
  launched: number;
  launchedToday: number;
  volume24h: number;
  trades24h: number;
  buys24h: number;
  sells24h: number;
};

const SIX_HOURS = 6 * 3600_000;
const DAY = 24 * 3600_000;

export function toBoardRow(t: LaunchedToken, m: TokenMarketSummary | undefined): LaunchBoardRow {
  const buys = m?.buys24h ?? 0;
  const sells = m?.sells24h ?? 0;
  return {
    address: t.address.toLowerCase(),
    name: t.name,
    symbol: t.symbol,
    imageUrl: t.imageUrl,
    createdAt: t.createdAt,
    quoteAsset: t.quoteAssetSymbol ?? t.quoteAsset,
    liquidityLocked: t.liquidityLocked,
    creatorFeeBps: t.creatorFeeBps,
    antiSnipeBlocks: t.antiSnipeBlocks,
    priceUsd: m?.priceUsd ?? null,
    marketCap: m?.marketCap ?? null,
    volume24h: m?.volume24h ?? 0,
    priceChange24h: m?.priceChange24h ?? null,
    buys24h: buys,
    sells24h: sells,
    hasPool: Boolean(m?.hasPool),
  };
}

/**
 * "Trending today" score, after openlaunch's board: activity (trades, log scale) and volume
 * (log scale), with a boost for tokens under 6 hours old so new launches get seen.
 * Tokens with no trades today don't rank.
 */
export function trendingScore(row: LaunchBoardRow, now: number): number {
  const trades = row.buys24h + row.sells24h;
  if (trades === 0 && row.volume24h === 0) return 0;
  const fresh = now - row.createdAt < SIX_HOURS ? 1.5 : 0;
  return 2 * Math.log10(1 + trades) + Math.log10(1 + row.volume24h) + fresh;
}

export function buildLaunchBoard(
  tokens: LaunchedToken[],
  markets: Record<string, TokenMarketSummary>,
  now: number,
  limit = 10
): { stats: LaunchBoardStats; trending: LaunchBoardRow[]; justLaunched: LaunchBoardRow[] } {
  const rows = tokens.map((t) => toBoardRow(t, markets[t.address.toLowerCase()]));
  const stats = rows.reduce<LaunchBoardStats>(
    (acc, r) => {
      acc.volume24h += r.volume24h;
      acc.buys24h += r.buys24h;
      acc.sells24h += r.sells24h;
      if (now - r.createdAt < DAY) acc.launchedToday += 1;
      return acc;
    },
    { launched: rows.length, launchedToday: 0, volume24h: 0, trades24h: 0, buys24h: 0, sells24h: 0 }
  );
  stats.trades24h = stats.buys24h + stats.sells24h;

  const trending = rows
    .map((r) => ({ r, s: trendingScore(r, now) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r);
  const justLaunched = [...rows].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  return { stats, trending, justLaunched };
}
