import type { AlchemyTransfer } from "@/lib/types/wallet";

export async function fetchWalletTransfers(
  address: string
): Promise<AlchemyTransfer[]> {
  try {
    const r = await fetch(
      `/api/wallet-txs?address=${encodeURIComponent(address)}`,
      { cache: "no-store", credentials: "same-origin" }
    );
    if (!r.ok) return [];
    const data = (await r.json()) as { transfers?: AlchemyTransfer[] };
    return data.transfers ?? [];
  } catch {
    return [];
  }
}
