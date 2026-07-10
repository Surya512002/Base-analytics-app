import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";

export type MarketStats = {
  tokenCount: number;
  pooledCount: number;
  totalVolume24h: number;
  totalLiquidity: number;
};

export type GlobalActivityItem = {
  type: "swap" | "launch";
  token: string;
  symbol: string;
  name: string;
  side?: "buy" | "sell";
  valueUsd?: number;
  amountEth?: string;
  txHash?: string;
  timestamp: number;
  label: string;
};

export async function fetchMarketData(): Promise<{
  markets: Record<string, TokenMarketSummary>;
  stats: MarketStats;
}> {
  const r = await fetch("/api/launchpad/market", { cache: "no-store" });
  if (!r.ok) {
    return {
      markets: {},
      stats: { tokenCount: 0, pooledCount: 0, totalVolume24h: 0, totalLiquidity: 0 },
    };
  }
  return r.json();
}

export async function fetchMarketBatch(
  addresses: string[]
): Promise<Record<string, TokenMarketSummary>> {
  if (!addresses.length) return {};
  try {
    const r = await fetch("/api/launchpad/market/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses }),
      cache: "no-store",
    });
    if (!r.ok) return {};
    const data = (await r.json()) as { markets?: Record<string, TokenMarketSummary> };
    return data.markets ?? {};
  } catch {
    return {};
  }
}

export async function fetchGlobalActivity(limit = 20): Promise<{
  activities: GlobalActivityItem[];
  ethUsd: number;
}> {
  const r = await fetch(`/api/launchpad/activity?limit=${limit}`, { cache: "no-store" });
  if (!r.ok) return { activities: [], ethUsd: 2500 };
  return r.json();
}

export type { TokenMarketSummary };
