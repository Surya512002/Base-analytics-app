import type { AnalyzeWalletResult } from "@/lib/types/wallet";
import type { FetchMode } from "@/lib/api/fetch-limits";

export async function fetchWalletAnalysis(
  address: string,
  mode: FetchMode = "full",
  refresh = false
): Promise<(AnalyzeWalletResult & { cached?: boolean; mode?: FetchMode }) | null> {
  try {
    const qs = new URLSearchParams({ address, mode });
    if (refresh) qs.set("refresh", "1");
    const r = await fetch(`/api/analyze-wallet?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as AnalyzeWalletResult & {
      cached?: boolean;
      mode?: FetchMode;
    };
  } catch {
    return null;
  }
}
