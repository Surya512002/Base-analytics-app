/**
 * Client-side analysis freshness — avoids re-running long analyze/sync on every
 * app open while the browser wallet is still "connected". Safe for spend;
 * never pauses the deployment.
 */

const FRESH_PREFIX = "ba_analysis_fresh_v1_";
/** Reuse score for this long before a background re-scan (4 hours). */
export const ANALYSIS_FRESH_MS = 4 * 60 * 60 * 1000;
/** History refine can be skipped this long after we marked it complete. */
export const HISTORY_COMPLETE_FRESH_MS = 6 * 60 * 60 * 1000;

export type AnalysisFreshness = {
  updatedAt: number;
  historyComplete: boolean;
  score: number;
  uniqueDays: number;
  txCount: number;
};

function key(address: string): string {
  return `${FRESH_PREFIX}${address.toLowerCase()}`;
}

export function readAnalysisFreshness(
  address: string
): AnalysisFreshness | null {
  if (typeof window === "undefined" || !address) return null;
  try {
    const raw = localStorage.getItem(key(address));
    if (!raw) return null;
    const data = JSON.parse(raw) as AnalysisFreshness;
    if (!data?.updatedAt || typeof data.updatedAt !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

export function markAnalysisFresh(
  address: string,
  meta: {
    historyComplete?: boolean;
    score?: number;
    uniqueDays?: number;
    txCount?: number;
  }
): void {
  if (typeof window === "undefined" || !address) return;
  try {
    const prev = readAnalysisFreshness(address);
    const next: AnalysisFreshness = {
      updatedAt: Date.now(),
      historyComplete: Boolean(
        meta.historyComplete ?? prev?.historyComplete ?? false
      ),
      score: meta.score ?? prev?.score ?? 0,
      uniqueDays: meta.uniqueDays ?? prev?.uniqueDays ?? 0,
      txCount: meta.txCount ?? prev?.txCount ?? 0,
    };
    localStorage.setItem(key(address), JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

export function clearAnalysisFreshness(address: string): void {
  if (typeof window === "undefined" || !address) return;
  try {
    localStorage.removeItem(key(address));
  } catch {
    /* ignore */
  }
}

/** Score still warm — skip full analyze on reconnect. */
export function isAnalysisFresh(
  address: string,
  maxAgeMs = ANALYSIS_FRESH_MS
): boolean {
  const f = readAnalysisFreshness(address);
  if (!f || f.score <= 0) return false;
  return Date.now() - f.updatedAt < maxAgeMs;
}

/** Skip wallet-sync polls for a while after any successful score/refine. */
export function isHistorySyncFresh(
  address: string,
  maxAgeMs = HISTORY_COMPLETE_FRESH_MS
): boolean {
  const f = readAnalysisFreshness(address);
  if (!f || f.score <= 0) return false;
  if (Date.now() - f.updatedAt >= maxAgeMs) return false;
  // Full complete, or score warm enough that we already refined this session window.
  return true;
}

/**
 * Background open: skip expensive re-index when local score is still warm.
 * (History soft-completes within the same freshness window.)
 */
export function shouldSkipBackgroundRescan(address: string): boolean {
  return isAnalysisFresh(address) && isHistorySyncFresh(address);
}
