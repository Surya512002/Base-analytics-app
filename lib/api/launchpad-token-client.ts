import type { LaunchDex } from "@/lib/launchpad/dex";

export type TokenPairStats = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  priceUsd?: string;
  priceNative?: string;
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number };
  txns?: {
    h24?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
    m5?: { buys?: number; sells?: number };
  };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
};

export async function fetchTokenPairs(address: string): Promise<{
  pairs: TokenPairStats[];
  error?: string;
}> {
  const r = await fetch(`/api/launchpad/token/${address}`, { cache: "no-store" });
  if (!r.ok) return { pairs: [], error: "Failed to load pool stats" };
  return r.json();
}

export type EnrichedHolder = {
  address: string;
  quantity: string;
  balance: number;
  pctSupply: number;
  valueUsd: number;
  tag: string;
};

export async function fetchTopHolders(
  token: string,
  opts?: {
    decimals?: number;
    priceUsd?: number;
    supplyCap?: string;
    pool?: string;
    creator?: string;
  }
): Promise<{
  holders: EnrichedHolder[];
  top10Pct?: number;
  error?: string;
}> {
  const qs = new URLSearchParams({ token, offset: "10" });
  if (opts?.decimals) qs.set("decimals", String(opts.decimals));
  if (opts?.priceUsd) qs.set("priceUsd", String(opts.priceUsd));
  if (opts?.supplyCap) qs.set("supplyCap", opts.supplyCap);
  if (opts?.pool) qs.set("pool", opts.pool);
  if (opts?.creator) qs.set("creator", opts.creator);
  const r = await fetch(`/api/launchpad/holders?${qs}`, { cache: "no-store" });
  if (!r.ok) return { holders: [], error: "Failed to load holders" };
  return r.json();
}

export type RecentSwapRow = {
  txHash?: string;
  blockNumber?: string;
  timestamp: number | null;
  side: "buy" | "sell";
  trader: string;
  amountToken: string;
  amountEth: string;
  priceEth?: number;
  priceUsd?: number;
  valueUsd?: number;
  ethUsd?: number;
  dexId: string;
  pool: string;
};

export async function fetchRecentSwaps(token: string, limit = 25): Promise<{
  swaps: RecentSwapRow[];
  dexId?: string;
  pool?: string;
  ethUsd?: number;
  error?: string;
}> {
  const r = await fetch(
    `/api/launchpad/swaps?token=${token}&limit=${limit}`,
    { cache: "no-store" }
  );
  if (!r.ok) return { swaps: [], error: "Failed to load swaps" };
  return r.json();
}

export type { LaunchDex };
