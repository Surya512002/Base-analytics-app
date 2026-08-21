import type { AnalyzeWalletResult } from "@/lib/types/wallet";
import { cacheGet, cacheSet } from "@/lib/redis-cache";

/** Shared analyze snapshot — works across Vercel serverless instances (unlike in-memory). */
export const ANALYZE_CACHE_TTL_SECONDS = 4 * 60 * 60; // 4h — fewer re-indexes on reconnect

/** Bump when analyze output shape changes — drops stale low-quality snapshots. */
export const ANALYZE_CACHE_VERSION = "v25";

/** In-process fallback when Redis is slow/unavailable — instant reconnect in dev. */
const memAnalyze = new Map<
  string,
  { data: AnalyzeWalletResult & { historyComplete?: boolean }; expires: number }
>();

export function analyzeCacheKey(address: string): string {
  return `analyze-wallet:${ANALYZE_CACHE_VERSION}:${address.toLowerCase()}`;
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
  if (!isUsableAnalyzeCache(result)) return;
  const key = analyzeCacheKey(address);
  const existing = memAnalyze.get(key)?.data;
  // Never let a thin incomplete preview replace a fuller snapshot.
  if (
    existing &&
    existing.historyComplete === true &&
    result.historyComplete !== true
  ) {
    return;
  }
  if (
    existing &&
    result.historyComplete !== true &&
    (existing.wallet?.uniqueDays ?? 0) > (result.wallet?.uniqueDays ?? 0)
  ) {
    return;
  }
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
  if ((w.uniqueDays ?? 0) === 0 && (w.txCount ?? 0) < 10) return false;
  const last = (w.lastTx || "").toLowerCase();
  if (last.includes("sync") || last.includes("fetch") || last === "") return false;
  const txs = w.txCount ?? 0;
  const days = w.uniqueDays ?? 0;
  if (txs > 200 && days > 100) {
    const eth = parseFloat(w.ethVolume || "0");
    const swap = w.dexVolumeUSD ?? 0;
    if (eth < 0.5 && swap < 500) return false;
  }
  return true;
}
