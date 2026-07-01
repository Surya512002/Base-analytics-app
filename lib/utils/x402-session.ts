/** Client-side x402 — lifetime payment count only; unlock is per session (React state). */

export function x402StorageKeys(address: string) {
  const key = address.toLowerCase();
  return {
    count: `x402_count_${key}`,
    /** @deprecated Session-only — cleared on connect; do not read or write */
    unlocked: `x402_unlocked_${key}`,
    /** @deprecated Session-only — cleared on connect; do not read or write */
    lastTx: `x402_last_tx_${key}`,
    /** @deprecated Session-only — cleared on connect; do not read or write */
    insights: `x402_insights_${key}`,
  };
}

/** Drop any persisted unlock/insights from older builds. Keeps lifetime pay count. */
export function lockX402PremiumSession(address: string): void {
  if (typeof window === "undefined" || !address) return;
  const keys = x402StorageKeys(address);
  localStorage.removeItem(keys.unlocked);
  localStorage.removeItem(keys.lastTx);
  localStorage.removeItem(keys.insights);
}

/** @deprecated Use lockX402PremiumSession */
export const clearX402PremiumForAddress = lockX402PremiumSession;
