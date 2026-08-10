import type { AnalyzeWalletResult } from "@/lib/types/wallet";
import {
  clearAnalysisFreshness,
  markAnalysisFresh,
} from "@/lib/utils/analysis-freshness";

const CACHE_VERSION = 41;
/** Align with analysis freshness (~4h). */
const TTL_MS = 4 * 60 * 60 * 1000;

function storageKey(address: string): string {
  return `base_analytics_wallet_v${CACHE_VERSION}_${address.toLowerCase()}`;
}

/** Must match server isUsableAnalyzeCache — pure, safe for browser. */
export function isUsableWalletCache(
  result: AnalyzeWalletResult & { historyComplete?: boolean }
): boolean {
  const w = result.wallet;
  if (!w?.address) return false;
  if (w.recommendation === "Fetching onchain data…") return false;
  if ((w.score ?? 0) <= 0) return false;
  if ((w.uniqueDays ?? 0) === 0 && (w.txCount ?? 0) < 10) return false;
  const txs = w.txCount ?? 0;
  const days = w.uniqueDays ?? 0;
  if (txs > 200 && days > 100) {
    const eth = parseFloat(w.ethVolume || "0");
    const swap = w.dexVolumeUSD ?? 0;
    if (eth < 0.5 && swap < 500) return false;
  }
  return true;
}

type CachedEnvelope = {
  savedAt: number;
  complete: boolean;
  result: AnalyzeWalletResult & { historyComplete?: boolean };
};

/** Local snapshot for reconnect — avoids Vercel re-analyze on every app open. */
export function readWalletCacheAny(
  address: string
): {
  result: AnalyzeWalletResult & { historyComplete?: boolean };
  complete: boolean;
} | null {
  if (typeof window === "undefined" || !address) return null;
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (!raw) return null;
    const env = JSON.parse(raw) as CachedEnvelope;
    if (!env?.result?.wallet?.address || !env.savedAt) return null;
    if (Date.now() - env.savedAt > TTL_MS) {
      localStorage.removeItem(storageKey(address));
      return null;
    }
    if (!isUsableWalletCache(env.result)) return null;
    return { result: env.result, complete: Boolean(env.complete) };
  } catch {
    return null;
  }
}

export function readWalletCache(
  address: string
): (AnalyzeWalletResult & { historyComplete?: boolean }) | null {
  return readWalletCacheAny(address)?.result ?? null;
}

export function writeWalletCache(
  address: string,
  result: AnalyzeWalletResult & { historyComplete?: boolean },
  complete = false
): void {
  if (typeof window === "undefined" || !address || !result?.wallet) return;
  if (!isUsableWalletCache(result)) return;
  try {
    const env: CachedEnvelope = {
      savedAt: Date.now(),
      complete: complete || result.historyComplete === true,
      result: {
        ...result,
        historyComplete: complete || result.historyComplete === true,
      },
    };
    localStorage.setItem(storageKey(address), JSON.stringify(env));
    markAnalysisFresh(address, {
      historyComplete: env.complete,
      score: result.wallet.score,
      uniqueDays: result.wallet.uniqueDays,
      txCount: result.wallet.txCount,
    });
  } catch {
    /* ignore */
  }
}

export function clearWalletCache(address: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = address.toLowerCase();
    for (let v = 1; v <= 50; v++) {
      localStorage.removeItem(`base_analytics_wallet_v${v}_${key}`);
    }
    clearAnalysisFreshness(address);
  } catch {
    /* ignore */
  }
}

export function purgeLegacyWalletCaches(address: string): void {
  clearWalletCache(address);
}
