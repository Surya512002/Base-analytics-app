import type { GlobalActivityItem } from "@/lib/api/launchpad-market-client";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { isB20ExploreToken } from "@/lib/launchpad/token-meta";
import { sortByMarketVolume } from "@/lib/launchpad/merge-tokens";

const MIN_LIQ_SAFE = 5_000;
const MIN_LIQ_LOW = 1_000;

export type TokenSafetyLevel = "pooled" | "low" | "new" | "none";

export function tokenSafetyLevel(market?: TokenMarketSummary): TokenSafetyLevel {
  if (!market?.hasPool) return "none";
  const liq = market.liquidityUsd ?? 0;
  if (liq >= MIN_LIQ_SAFE) return "pooled";
  if (liq >= MIN_LIQ_LOW) return "low";
  return "new";
}

export function tokenSafetyLabel(level: TokenSafetyLevel): string {
  switch (level) {
    case "pooled":
      return "✓ Pooled";
    case "low":
      return "Low liq";
    case "new":
      return "New pool";
    default:
      return "No pool";
  }
}

/** Top B20 by 24h volume for spotlight (matches OG trending logic). */
export function pickB20Spotlight(
  tokens: LaunchedToken[],
  markets: Record<string, TokenMarketSummary>
): { token: LaunchedToken; market?: TokenMarketSummary } | null {
  const b20 = tokens.filter(isB20ExploreToken);
  const ranked = sortByMarketVolume(
    b20.filter((t) => {
      const m = markets[t.address.toLowerCase()];
      return m?.hasPool && (m.volume24h ?? 0) > 0;
    }),
    markets
  );
  const token = ranked[0];
  if (!token) return null;
  return { token, market: markets[token.address.toLowerCase()] };
}

/** Tokens with most swap/launch activity in the last hour. */
export function buildHotTokens(
  activities: GlobalActivityItem[],
  tokens: LaunchedToken[],
  markets: Record<string, TokenMarketSummary>,
  limit = 8
): LaunchedToken[] {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const counts = new Map<string, number>();
  for (const a of activities) {
    if (a.timestamp < hourAgo) continue;
    const addr = a.token.toLowerCase();
    counts.set(addr, (counts.get(addr) ?? 0) + 1);
  }

  const byAddr = new Map(tokens.map((t) => [t.address.toLowerCase(), t]));
  const scored: { token: LaunchedToken; score: number }[] = [];

  for (const [addr, token] of byAddr) {
    const recent = counts.get(addr) ?? 0;
    const vol = markets[addr]?.volume24h ?? 0;
    const score = recent * 2_000 + vol;
    if (score > 0) scored.push({ token, score });
  }

  scored.sort((a, b) => b.score - a.score);
  if (scored.length >= limit) return scored.slice(0, limit).map((s) => s.token);

  const trending = sortByMarketVolume(tokens, markets).filter(
    (t) => (markets[t.address.toLowerCase()]?.volume24h ?? 0) > 0
  );
  const seen = new Set(scored.map((s) => s.token.address.toLowerCase()));
  for (const t of trending) {
    if (scored.length >= limit) break;
    if (seen.has(t.address.toLowerCase())) continue;
    scored.push({ token: t, score: 0 });
    seen.add(t.address.toLowerCase());
  }
  return scored.slice(0, limit).map((s) => s.token);
}

export function countRecentLaunches(activities: GlobalActivityItem[], days = 7): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return activities.filter((a) => a.type === "launch" && a.timestamp >= cutoff).length;
}

export function countRecentSwaps(activities: GlobalActivityItem[], hours = 24): number {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return activities.filter((a) => a.type === "swap" && a.timestamp >= cutoff).length;
}
