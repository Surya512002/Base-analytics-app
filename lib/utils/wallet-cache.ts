import type { AnalyzeWalletResult } from "@/lib/types/wallet";

const CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface StoredWalletCache {
  v: number;
  ts: number;
  result: AnalyzeWalletResult;
}

function cacheKey(address: string): string {
  return `base_analytics_wallet_v${CACHE_VERSION}_${address.toLowerCase()}`;
}

export function readWalletCache(
  address: string
): AnalyzeWalletResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWalletCache;
    if (parsed.v !== CACHE_VERSION) return null;
    if (Date.now() - parsed.ts > CACHE_MAX_AGE_MS) return null;
    return parsed.result;
  } catch {
    return null;
  }
}

export function writeWalletCache(
  address: string,
  result: AnalyzeWalletResult
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredWalletCache = {
      v: CACHE_VERSION,
      ts: Date.now(),
      result,
    };
    localStorage.setItem(cacheKey(address), JSON.stringify(payload));
  } catch {
    // quota / private mode
  }
}

export function clearWalletCache(address: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(cacheKey(address));
  } catch {
    // ignore
  }
}
