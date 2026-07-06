import type { AnalyzeWalletResult } from "@/lib/types/wallet";

/** Local wallet snapshot cache removed — connect always fetches fresh onchain data. */
export function readWalletCacheAny(
  _address: string
): { result: AnalyzeWalletResult; complete: boolean } | null {
  return null;
}

export function readWalletCache(_address: string): AnalyzeWalletResult | null {
  return null;
}

export function writeWalletCache(
  _address: string,
  _result: AnalyzeWalletResult,
  _complete = true
): void {
  // no-op
}

export function clearWalletCache(_address: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = _address.toLowerCase();
    for (let v = 1; v <= 40; v++) {
      localStorage.removeItem(`base_analytics_wallet_v${v}_${key}`);
    }
  } catch {
    // ignore
  }
}

export function purgeLegacyWalletCaches(address: string): void {
  clearWalletCache(address);
}

export function isUsableWalletCache(_result: AnalyzeWalletResult): boolean {
  return false;
}
