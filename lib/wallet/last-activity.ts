import type { WalletData } from "@/lib/types/wallet";

function isPlaceholderLastTx(value: string | undefined): boolean {
  const s = (value || "").trim().toLowerCase();
  if (!s) return true;
  return (
    s === "n/a" ||
    s.includes("sync") ||
    s.includes("fetch") ||
    s.includes("loading")
  );
}

/**
 * True once we have indexed the wallet's latest onchain activity
 * (recent txs / last tx date) — or confirmed the wallet has none.
 * Bootstrap shells with "Syncing…" lastTx never pass.
 */
export function hasIndexedLastActivity(wallet: WalletData | null | undefined): boolean {
  if (!wallet?.address) return false;
  const rec = (wallet.recommendation || "").toLowerCase();
  if (rec.includes("fetching onchain") || rec.includes("syncing")) return false;

  if ((wallet.recentTxs?.length ?? 0) > 0) return true;
  if (!isPlaceholderLastTx(wallet.lastTx)) return true;

  return (
    wallet.txCount === 0 &&
    wallet.uniqueDays === 0 &&
    wallet.lastTx === "N/A"
  );
}
