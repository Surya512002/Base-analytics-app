import type { AnalyzeWalletResult } from "@/lib/types/wallet";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Identical requests already in flight share one response. On connect, the connect flow and the
 * background analysis both asked for bootstrap + quick analyze for the same wallet at the same
 * time, doubling the heaviest serverless calls.
 */
const inflight = new Map<string, Promise<unknown>>();
function fetchAnalyzeJson<T>(path: string, timeoutMs: number, retries = 2, address?: string): Promise<T | null> {
  const hit = inflight.get(path);
  if (hit) return hit as Promise<T | null>;
  const p = fetchAnalyzeJsonUncached<T>(path, timeoutMs, retries, address).finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

async function fetchAnalyzeJsonUncached<T>(
  path: string,
  timeoutMs: number,
  retries = 2,
  _address?: string
): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(path, {
        cache: "no-store",
        credentials: "same-origin",
        signal: AbortSignal.timeout(timeoutMs),
      });
      const contentType = r.headers.get("content-type") || "";
      if (!r.ok) {
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
    refresh ? 90_000 : 25_000,
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

/** Real score + metrics — quick analyze path; uses server cache when warm. */
export async function fetchWalletAnalysisQuick(
  address: string,
  refresh = false
): Promise<(AnalyzeWalletResult & { cached?: boolean }) | null> {
  const qs = new URLSearchParams({ address, quick: "1" });
  if (refresh) qs.set("refresh", "1");
  return fetchAnalyzeJson<AnalyzeWalletResult & { cached?: boolean }>(
    `/api/analyze-wallet?${qs.toString()}`,
    45_000,
    2,
    address
  );
}

/** Server-side history sync — paginates until complete (poll until historyComplete). */
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
  const maxAttempts = 120;
  // Each pass is a ~55s serverless call. Stop when the server says the history source is
  // unavailable, or after 2 passes in a row that find nothing new.
  let lastProgress = -1;
  let idlePasses = 0;

  while (attempts < maxAttempts) {
    if (callbacks.shouldCancel?.()) return false;
    attempts++;

    callbacks.onProgress?.(
      attempts === 1
        ? "Syncing full onchain history via Alchemy…"
        : `Syncing full history… (pass ${attempts})`
    );

    try {
      const qs = new URLSearchParams({ address: addr });
      if (callbacks.reset && attempts === 1) qs.set("reset", "1");
      const data = await fetchAnalyzeJson<
        AnalyzeWalletResult & {
          historyComplete?: boolean;
          partial?: boolean;
          stalled?: boolean;
          sync?: { complete?: boolean; uniqueDays?: number; transferLegs?: number };
        }
      >(`/api/wallet-sync?${qs.toString()}`, 115_000, 1, addr);
      if (!data) break;
      if (data.stalled) return false;
      const progress = (data.sync?.uniqueDays ?? 0) * 1_000_000 + (data.sync?.transferLegs ?? 0);
      if (!(data.historyComplete === true || data.sync?.complete === true)) {
        if (progress <= lastProgress) {
          idlePasses++;
          if (idlePasses >= 2) return false;
        } else {
          idlePasses = 0;
        }
        lastProgress = Math.max(lastProgress, progress);
      }

      callbacks.onUpdate({
        ...data,
        historyComplete: data.historyComplete ?? data.sync?.complete,
      });

      callbacks.onProgress?.(
        data.sync?.uniqueDays
          ? `Synced ${data.sync.uniqueDays} active days…`
          : "Syncing…"
      );

      if (data.historyComplete === true || data.sync?.complete === true) {
        callbacks.onProgress?.(
          `History complete — ${data.wallet?.uniqueDays ?? 0} active days`
        );
        return true;
      }

      await sleep(400);
    } catch {
      await sleep(2000);
    }
  }

  return false;
}

export { fetchWalletTxsComplete } from "@/lib/api/wallet-history-sync";
