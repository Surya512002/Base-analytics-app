import type { LaunchedToken } from "@/lib/launchpad/types";
import type { WalletData } from "@/lib/types/wallet";

/** Personalized token picks from wallet swap history + holdings hints. */
export function buildForYouTokens(
  wallet: WalletData | null | undefined,
  catalog: LaunchedToken[],
  limit = 8
): LaunchedToken[] {
  if (!wallet || !catalog.length) return [];

  const byAddr = new Map(catalog.map((t) => [t.address.toLowerCase(), t]));
  const scored: { token: LaunchedToken; score: number }[] = [];
  const seen = new Set<string>();

  for (const sym of wallet.topTokens ?? []) {
    const match = catalog.find(
      (t) =>
        t.symbol.toLowerCase() === sym.toLowerCase() ||
        t.name.toLowerCase().includes(sym.toLowerCase())
    );
    if (match && !seen.has(match.address.toLowerCase())) {
      scored.push({ token: match, score: 100 });
      seen.add(match.address.toLowerCase());
    }
  }

  for (const tx of wallet.recentTxs ?? []) {
    if (tx.category !== "erc20" || !tx.asset) continue;
    const match = catalog.find(
      (t) => t.symbol.toLowerCase() === tx.asset!.toLowerCase()
    );
    if (!match) continue;
    const addr = match.address.toLowerCase();
    if (seen.has(addr)) continue;
    scored.push({ token: match, score: 60 });
    seen.add(addr);
  }

  if (wallet.tokensSwapped > 0) {
    for (const t of catalog) {
      const a = t.address.toLowerCase();
      if (seen.has(a)) continue;
      if (t.creator?.toLowerCase() === wallet.address.toLowerCase()) {
        scored.push({ token: t, score: 50 });
        seen.add(a);
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  if (scored.length >= limit) return scored.slice(0, limit).map((s) => s.token);

  for (const t of catalog) {
    if (scored.length >= limit) break;
    if (seen.has(t.address.toLowerCase())) continue;
    scored.push({ token: t, score: 0 });
  }

  return scored.slice(0, limit).map((s) => s.token);
}
