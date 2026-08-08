import type { LaunchedToken } from "@/lib/launchpad/types";

const RECENT_KEY = "base_explore_recent_searches";
const MAX_RECENT = 8;

export type TokenSearchHit = {
  address: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  liquidityUsd: number;
  volume24h: number;
  priceUsd?: number;
};

export function filterTokensByQuery(tokens: LaunchedToken[], query: string): LaunchedToken[] {
  const q = query.trim().toLowerCase();
  if (!q) return tokens.slice(0, 12);
  return tokens
    .filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q)
    )
    .slice(0, 12);
}

export function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentSearch(query: string): void {
  const q = query.trim();
  if (!q || typeof window === "undefined") return;
  const prev = readRecentSearches().filter((x) => x !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}
