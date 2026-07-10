/** Persist Farcaster x402 unlock per wallet (survives refresh; cleared on disconnect). */

function key(address: string): string {
  return `farcaster_unlocked_${address.toLowerCase()}`;
}

export function readFarcasterUnlocked(address: string): boolean {
  if (typeof window === "undefined" || !address) return false;
  return localStorage.getItem(key(address)) === "1";
}

export function writeFarcasterUnlocked(address: string): void {
  if (typeof window === "undefined" || !address) return;
  localStorage.setItem(key(address), "1");
}

export function clearFarcasterUnlocked(address: string): void {
  if (typeof window === "undefined" || !address) return;
  localStorage.removeItem(key(address));
}
