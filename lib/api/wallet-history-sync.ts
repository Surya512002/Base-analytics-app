/** @deprecated Use /api/wallet-sync — kept for fetchWalletTxsComplete only. */
export async function fetchWalletTxsComplete(
  address: string
): Promise<import("@/lib/types/wallet").AlchemyTransfer[]> {
  const qs = new URLSearchParams({
    address,
    depth: "complete",
    refresh: "1",
  });
  const r = await fetch(`/api/wallet-txs?${qs}`, { cache: "no-store" });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.transfers as import("@/lib/types/wallet").AlchemyTransfer[]) || [];
}
