"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import type { PlanFill, PlanProgress, PlansSummary } from "@/limit-orders/shared/planHistory";

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const tokens = (v: bigint, decimals: number) => Number(formatUnits(v, decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 });

export interface PlanHistoryState {
  status: "idle" | "loading" | "ready" | "unsupported" | "error";
  fills: PlanFill[];
  /** True when the search was cut short, so older runs may be missing. */
  partial: boolean;
}

const EMPTY: PlanHistoryState = { status: "idle", fills: [], partial: false };

/** Past runs for this wallet. Re-reads when `version` changes (a plan ran, was added or cancelled). */
export function usePlanHistory(chainId: number | null, owner: string | null, version: string): PlanHistoryState {
  const [state, setState] = useState<PlanHistoryState>(EMPTY);
  useEffect(() => {
    if (!chainId || !owner || !version) {
      setState(EMPTY);
      return;
    }
    let alive = true;
    const load = () => {
      setState((s) => (s.status === "ready" ? s : { ...EMPTY, status: "loading" }));
      fetch(`/api/plans/history?chainId=${chainId}&owner=${owner}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { ok?: boolean; supported?: boolean; fills?: PlanFill[]; partial?: boolean } | null) => {
          if (!alive) return;
          if (!j?.ok) return setState((s) => (s.status === "ready" ? s : { ...EMPTY, status: "error" }));
          setState({ status: j.supported ? "ready" : "unsupported", fills: j.fills ?? [], partial: Boolean(j.partial) });
        })
        .catch(() => alive && setState((s) => (s.status === "ready" ? s : { ...EMPTY, status: "error" })));
    };
    load();
    // The transfer index can lag the chain by a few seconds, so look once more shortly after a change.
    const again = setTimeout(load, 25_000);
    return () => {
      alive = false;
      clearTimeout(again);
    };
  }, [chainId, owner, version]);
  return state;
}

export function PlansSummaryCard({ summary, history }: { summary: PlansSummary; history: PlanHistoryState }) {
  if (history.status === "loading") return <p className="px-1 text-[11px] text-[var(--ink-muted)]">Reading your plan history…</p>;
  if (history.status === "error") return <p role="status" className="px-1 text-[11px] text-amber-600 dark:text-amber-300">Plan history is unavailable right now. Your plans below are unaffected.</p>;
  if (history.status !== "ready") return null;
  const stat = (label: string, value: string, tone = "") => (
    <div className="rounded-xl bg-[var(--surface-2)] p-2.5">
      <span className="block text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">{label}</span>
      <span className={`text-sm font-black tabular-nums ${tone || "text-[var(--ink)]"}`}>{value}</span>
    </div>
  );
  const change = summary.changePct;
  return (
    <section aria-label="Plans summary" className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat("Runs so far", String(summary.runsDone))}
        {stat("Invested", usd(summary.invested))}
        {stat(
          "Worth now",
          summary.valueNow === null ? "—" : `${usd(summary.valueNow)}${change === null ? "" : ` (${change >= 0 ? "+" : ""}${change.toFixed(1)}%)`}`,
          change === null ? "" : change >= 0 ? "text-emerald-500" : "text-rose-500"
        )}
        {stat("Waiting to buy", usd(summary.waiting))}
      </div>
      {summary.soldFor > 0 && <p className="text-[11px] text-[var(--ink-muted)]">Recurring sells have paid you {usd(summary.soldFor)} so far.</p>}
      <p className="text-[11px] text-[var(--ink-muted)]">
        &quot;Worth now&quot; values the tokens your recurring buys delivered at today&apos;s Chainlink price, whether or not you still hold them. Prices can fall.
      </p>
      {(history.partial || !summary.complete) && (
        <p role="status" className="text-[11px] font-semibold text-amber-600 dark:text-amber-300">
          Some runs could not be read yet, so these totals may be short. They fill in on a later visit.
        </p>
      )}
    </section>
  );
}

export function PlanProgressLine({
  progress,
  isSell,
  stockSymbol,
  stockDecimals,
  quoteDecimals,
  priceNow,
}: {
  progress: PlanProgress;
  isSell: boolean;
  stockSymbol: string;
  stockDecimals: number;
  quoteDecimals: number;
  priceNow: number | null;
}) {
  const pct = progress.runsTotal > 0 ? Math.min(100, (progress.runsDone / progress.runsTotal) * 100) : 0;
  const vs = !isSell && progress.avgPrice && priceNow ? (priceNow / progress.avgPrice - 1) * 100 : null;
  return (
    <div className="space-y-1.5">
      <div
        role="progressbar"
        aria-label="Runs completed"
        aria-valuemin={0}
        aria-valuemax={progress.runsTotal}
        aria-valuenow={progress.runsDone}
        className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"
      >
        <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-[var(--ink-muted)]">
        <b className="text-[var(--ink)]">
          {progress.runsDone} of {progress.runsTotal}
        </b>{" "}
        runs done
        {progress.runsDone > 0 && (
          <>
            {" · "}
            {isSell
              ? `sold ${tokens(progress.spent, stockDecimals)} ${stockSymbol} for ${usd(Number(formatUnits(progress.received, quoteDecimals)))}`
              : `${usd(Number(formatUnits(progress.spent, quoteDecimals)))} bought ${tokens(progress.received, stockDecimals)} ${stockSymbol}`}
            {progress.avgPrice !== null && ` · average ${usd(progress.avgPrice)} (fee included)`}
            {vs !== null && (
              <span className={vs >= 0 ? "text-emerald-500" : "text-rose-500"}>
                {" "}
                · now {usd(priceNow as number)}, {vs >= 0 ? "+" : ""}
                {vs.toFixed(1)}%
              </span>
            )}
          </>
        )}
      </p>
    </div>
  );
}
