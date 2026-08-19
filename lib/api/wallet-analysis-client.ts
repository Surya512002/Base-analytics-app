import type { AnalyzeWalletResult } from "@/lib/types/wallet";
import {
  clearAnalyticsUnlocked,
  readAnalyticsUnlockToken,
} from "@/lib/utils/analytics-unlock";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function fetchAnalyzeJson<T>(
  path: string,
  timeoutMs: number,
  retries = 2,
  addressForUnlock?: string
): Promise<T | null> {
  const unlockToken = addressForUnlock
    ? readAnalyticsUnlockToken(addressForUnlock)
    : null;
  const headers: HeadersInit = unlockToken
    ? { "x-analytics-unlock": unlockToken }
    : {};

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(path, {
        cache: "no-store",
        credentials: "same-origin",
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const contentType = r.headers.get("content-type") || "";
      if (!r.ok) {
        if (r.status === 402) {
          // Legacy local unlock without server token → force re-pay.
          if (addressForUnlock) revokeClientUnlock(addressForUnlock);
          return null;
        }
        if (r.status >= 500 && attempt < retries) {
          await sleep(800 * (attempt + 1));
          continue;
        }
        return null;
      }
      if (!contentType.includes("application/json")) return null;
      return (await r.json()) as T;
    } catch {
      if (attempt < retries) {
        await sleep(800 * (attempt + 1));
        continue;
      }
    }
  }
  return null;
}

export async function fetchWalletAnalysis(
  address: string,
  refresh = false
): Promise<(AnalyzeWalletResult & { cached?: boolean }) | null> {
  const qs = new URLSearchParams({ address });
  if (refresh) qs.set("refresh", "1");
  return fetchAnalyzeJson<AnalyzeWalletResult & { cached?: boolean }>(
    `/api/analyze-wallet?${qs.toString()}`,
    // Cache miss needs room for Alchemy full-page walk + score compute.
    refresh ? 95_000 : 55_000,
    2,
    address
  );
}

/** Fast shell (~3–8s) — unblocks UI when full analyze is slow or retrying. */
export async function fetchWalletBootstrap(
  address: string
): Promise<(AnalyzeWalletResult & { bootstrapped?: boolean }) | null> {
  const qs = new URLSearchParams({ address });
  // Bootstrap is free — no Alchemy / no unlock header required.
  return fetchAnalyzeJson<AnalyzeWalletResult & { bootstrapped?: boolean }>(
    `/api/wallet-bootstrap?${qs.toString()}`,
    15_000
  );
}

/** Fast first score from newest activity (~8–12s). */
export async function fetchWalletAnalysisRecent(
  address: string,
  refresh = true
): Promise<(AnalyzeWalletResult & { cached?: boolean }) | null> {
  const qs = new URLSearchParams({ address, recent: "1" });
  if (refresh) qs.set("refresh", "1");
  return fetchAnalyzeJson<AnalyzeWalletResult & { cached?: boolean }>(
    `/api/analyze-wallet?${qs.toString()}`,
    22_000,
    1,
    address
  );
}

/** Real score + metrics — quick analyze path; uses server cache when warm. */
export async function fetchWalletAnalysisQuick(
  address: string,
  refresh = false
): Promise<(AnalyzeWalletResult & { cached?: boolean }) | null> {
  const qs = new URLSearchParams({ address, quick: "1" });
  if (refresh) qs.set("refresh", "1");
  return fetchAnalyzeJson<AnalyzeWalletResult & { cached?: boolean }>(
    `/api/analyze-wallet?${qs.toString()}`,
    20_000,
    1,
    address
  );
}

/**
 * Background history refine until the *server* reports historyComplete.
 * Never soft-completes on day plateaus (that dropped older heatmap days).
 */
export async function pollWalletHistorySync(
  address: string,
  callbacks: {
    onUpdate: (result: AnalyzeWalletResult & { historyComplete?: boolean }) => void;
    onProgress?: (msg: string) => void;
    shouldCancel?: () => boolean;
    reset?: boolean;
  }
): Promise<boolean> {
  const addr = address.toLowerCase();
  let attempts = 0;
  const maxAttempts = 8;
  let lastDays = -1;
  let plateauPasses = 0;
  const short = `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  while (attempts < maxAttempts) {
    if (callbacks.shouldCancel?.()) return false;
    attempts++;

    callbacks.onProgress?.(
      attempts === 1
        ? `Collecting full history for ${short}…`
        : `Indexing ${short}… (pass ${attempts}/${maxAttempts})`
    );

    try {
      const qs = new URLSearchParams({ address: addr });
      if (callbacks.reset && attempts === 1) qs.set("reset", "1");
      const data = await fetchAnalyzeJson<
        AnalyzeWalletResult & {
          historyComplete?: boolean;
          partial?: boolean;
          sync?: { complete?: boolean; uniqueDays?: number };
        }
      >(`/api/wallet-sync?${qs.toString()}`, 95_000, 1, addr);
      if (!data) break;

      const complete =
        data.historyComplete === true || data.sync?.complete === true;

      callbacks.onUpdate({
        ...data,
        historyComplete: complete,
      });

      const days =
        data.sync?.uniqueDays ?? data.wallet?.uniqueDays ?? 0;
      callbacks.onProgress?.(
        days > 0
          ? `${short}: ${days} active day${days === 1 ? "" : "s"} indexed`
          : `Indexing transfers for ${short}…`
      );

      if (complete) {
        callbacks.onProgress?.(
          `Ready — ${data.wallet?.uniqueDays ?? days} active days for ${short}`
        );
        return true;
      }

      if (days === lastDays && days > 0) {
        plateauPasses++;
      } else {
        plateauPasses = 0;
        lastDays = days;
      }
      if (plateauPasses >= 4 && days > 0) {
        callbacks.onProgress?.(
          `Still refining ${short} (${days} days so far)…`
        );
      }

      await sleep(800);
    } catch {
      await sleep(1_500);
    }
  }

  // Hard cap without server complete — leave history incomplete for next open.
  return false;
}

export { fetchWalletTxsComplete } from "@/lib/api/wallet-history-sync";
