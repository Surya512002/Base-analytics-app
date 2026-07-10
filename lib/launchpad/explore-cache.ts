import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import type { LaunchedToken } from "@/lib/launchpad/types";

export type ExploreCacheSnapshot = {
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
  b20Activated: boolean | null;
  marketStats: {
    totalVolume24h: number;
    totalLiquidity: number;
  };
  fetchedAt: number;
};

let snapshot: ExploreCacheSnapshot | null = null;

const MAX_AGE_MS = 90_000;

export function readExploreCache(): ExploreCacheSnapshot | null {
  if (!snapshot) return null;
  if (Date.now() - snapshot.fetchedAt > MAX_AGE_MS) return null;
  return snapshot;
}

export function writeExploreCache(data: Omit<ExploreCacheSnapshot, "fetchedAt">): void {
  snapshot = { ...data, fetchedAt: Date.now() };
}

export function hasExploreCache(): boolean {
  return readExploreCache() !== null;
}
