/** Persist core analytics x402 unlock per wallet (survives refresh; cleared on disconnect). */

function key(address: string): string {
  return `analytics_unlocked_${address.toLowerCase()}`;
}

function tokenKey(address: string): string {
  return `analytics_unlock_token_${address.toLowerCase()}`;
}

export function readAnalyticsUnlocked(address: string): boolean {
  if (typeof window === "undefined" || !address) return false;
  return localStorage.getItem(key(address)) === "1";
}

export function writeAnalyticsUnlocked(address: string, token?: string): void {
  if (typeof window === "undefined" || !address) return;
  localStorage.setItem(key(address), "1");
  if (token) {
    localStorage.setItem(tokenKey(address), token);
  }
}

export function readAnalyticsUnlockToken(address: string): string | null {
  if (typeof window === "undefined" || !address) return null;
  return localStorage.getItem(tokenKey(address));
}

export function clearAnalyticsUnlocked(address: string): void {
  if (typeof window === "undefined" || !address) return;
  localStorage.removeItem(key(address));
  localStorage.removeItem(tokenKey(address));
}
