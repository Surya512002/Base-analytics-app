import type { AnalyzeWalletResult } from "@/lib/types/wallet";

export async function fetchWalletAnalysis(
  address: string,
  refresh = false
): Promise<(AnalyzeWalletResult & { cached?: boolean }) | null> {
  try {
    const qs = new URLSearchParams({ address });
    if (refresh) qs.set("refresh", "1");
    const r = await fetch(`/api/analyze-wallet?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as AnalyzeWalletResult & { cached?: boolean };
  } catch {
    return null;
  }
}
