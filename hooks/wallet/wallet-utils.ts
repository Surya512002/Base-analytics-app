import type { AnalyzeWalletResult } from "@/lib/types/wallet";
import { resolveTabFromUrl } from "@/lib/utils/app-url";

export type AppTab =
  | "launchpad"
  | "swap"
  | "lend"
  | "basehub"
  | "profile";

export function resolveInitialTab(): AppTab {
  if (typeof window !== "undefined") {
    if (window.location.pathname.startsWith("/swap")) return "swap";
    if (window.location.pathname.startsWith("/lend") || window.location.pathname.startsWith("/earn")) return "lend";
    if (window.location.pathname.startsWith("/explore")) return "launchpad";
    if (window.location.pathname.startsWith("/profile") || window.location.pathname.startsWith("/creator")) return "profile";
  }
  const fromUrl = resolveTabFromUrl();
  if (fromUrl) return fromUrl;
  return "launchpad";
}

export function analysisNeedsActivityRefresh(
  result?: (Partial<AnalyzeWalletResult> & { historyComplete?: boolean }) | null
): boolean {
  if (!result) return true;
  const w = result.wallet;
  if (!w?.address) return true;
  if (result.historyComplete !== true) return true;
  if (w.recommendation === "Fetching onchain data…") return true;
  if ((w.txCount ?? 0) > 0 && (w.recentTxs?.length ?? 0) === 0) return true;
  if (w.firstTx === "Syncing…" || w.lastTx === "Syncing…") return true;
  return false;
}
