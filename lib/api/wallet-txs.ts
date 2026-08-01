import type { AlchemyTransfer } from "@/lib/types/wallet";
import {
  clearAnalyticsUnlocked,
  readAnalyticsUnlockToken,
} from "@/lib/utils/analytics-unlock";

function revokeClientUnlock(address: string): void {
  clearAnalyticsUnlocked(address);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("ba-analytics-unlock-revoked", {
        detail: { address: address.toLowerCase() },
      })
    );
  }
}

export async function fetchWalletTransfers(
  address: string
): Promise<AlchemyTransfer[]> {
  try {
    const unlockToken = readAnalyticsUnlockToken(address);
    const headers: HeadersInit = unlockToken
      ? { "x-analytics-unlock": unlockToken }
      : {};
    const r = await fetch(
      `/api/wallet-txs?address=${encodeURIComponent(address)}`,
      { cache: "no-store", credentials: "same-origin", headers }
    );
    if (r.status === 402) {
      revokeClientUnlock(address);
      return [];
    }
    if (!r.ok) return [];
    const data = await r.json();
    return (data.transfers as AlchemyTransfer[]) || [];
  } catch {
    return [];
  }
}
