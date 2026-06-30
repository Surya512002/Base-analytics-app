/** Client-side x402 premium state — lifetime count vs per-session unlock. */

export function x402StorageKeys(address: string) {
  const key = address.toLowerCase();
  return {
    count: `x402_count_${key}`,
    unlocked: `x402_unlocked_${key}`,
    lastTx: `x402_last_tx_${key}`,
    insights: `x402_insights_${key}`,
  };
}

/** Lock premium for this session; keep lifetime payment count. */
export function lockX402PremiumSession(address: string): void {
  if (typeof window === "undefined" || !address) return;
  const keys = x402StorageKeys(address);
  localStorage.removeItem(keys.unlocked);
  localStorage.removeItem(keys.lastTx);
  localStorage.removeItem(keys.insights);
}

/** @deprecated Use lockX402PremiumSession */
export const clearX402PremiumForAddress = lockX402PremiumSession;
