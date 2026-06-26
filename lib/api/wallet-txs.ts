import type { AlchemyTransfer } from "@/lib/types/wallet";

export async function fetchWalletTransfers(
  address: string
): Promise<AlchemyTransfer[]> {
  try {
    const r = await fetch(
      `/api/wallet-txs?address=${encodeURIComponent(address)}`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const data = await r.json();
    return (data.transfers as AlchemyTransfer[]) || [];
  } catch {
    return [];
  }
}
