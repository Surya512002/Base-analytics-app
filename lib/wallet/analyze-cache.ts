import type { AnalyzeWalletResult } from "@/lib/types/wallet";
import { cacheGet, cacheSet } from "@/lib/redis-cache";

/** Shared analyze snapshot — works across Vercel serverless instances (unlike in-memory). */
export const ANALYZE_CACHE_TTL_SECONDS = 3600;

/** In-process fallback when Redis is slow/unavailable — instant reconnect in dev. */
const memAnalyze = new Map<
  string,
  { data: AnalyzeWalletResult & { historyComplete?: boolean }; expires: number }
>();

export function analyzeCacheKey(address: string): string {
  return `analyze-wallet:v17:${address.toLowerCase()}`;
}

export async function getCachedAnalyze(
  address: string
): Promise<(AnalyzeWalletResult & { historyComplete?: boolean }) | null> {
  const key = analyzeCacheKey(address);
  const mem = memAnalyze.get(key);
  if (mem && mem.expires > Date.now()) return mem.data;

  const cached = await cacheGet<
    AnalyzeWalletResult & { historyComplete?: boolean }
  >(key);
  if (cached && isUsableAnalyzeCache(cached)) {
    memAnalyze.set(key, {
      data: cached,
      expires: Date.now() + ANALYZE_CACHE_TTL_SECONDS * 1000,
    });
    return cached;
  }
  return null;
}

export async function setCachedAnalyze(
  address: string,
  result: AnalyzeWalletResult & { historyComplete?: boolean },
  ttlSeconds = ANALYZE_CACHE_TTL_SECONDS
): Promise<void> {
  const key = analyzeCacheKey(address);
  memAnalyze.set(key, {
    data: result,
    expires: Date.now() + ttlSeconds * 1000,
  });
  await cacheSet(key, result, ttlSeconds);
}

/** Usable on connect — real score + activity, not an empty shell. */
export function isUsableAnalyzeCache(
  result: AnalyzeWalletResult & { historyComplete?: boolean }
): boolean {
  const w = result.wallet;
  if (!w?.address) return false;
  if (w.recommendation === "Fetching onchain data…") return false;
  if ((w.score ?? 0) <= 0) return false;
  return (w.uniqueDays ?? 0) > 0 || (w.txCount ?? 0) >= 10;
}
