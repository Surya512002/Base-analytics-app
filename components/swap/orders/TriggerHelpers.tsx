"use client";

import { priceAtPct } from "@/src/lib/limitOrders/priceBasis";

const fmt = (n: number) => n.toFixed(n >= 1 ? 2 : 6);
const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One-tap prices a set percent away from the order price (Chainlink), e.g. -5% for a dip buy. */
export function PercentChips({ base, pcts, onPick, label }: { base: number | null; pcts: number[]; onPick: (price: string) => void; label: string }) {
  if (!base) return null;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {pcts.map((p) => {
        const price = priceAtPct(base, p);
        if (price === null) return null;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onPick(fmt(price))}
            className="min-h-[32px] rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 text-[11px] font-bold tabular-nums text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            {p > 0 ? "+" : ""}
            {p}%
          </button>
        );
      })}
    </div>
  );
}

/** Plain-English result of a stop or target on the position: dollars and percent. */
export function MoveLine({ kind, move }: { kind: "stop" | "target"; move: { usd: number; pct: number } | null }) {
  if (!move) return null;
  const loss = move.usd < 0;
  return (
    <p className={`text-[11px] font-semibold ${loss ? "text-rose-500" : "text-emerald-500"}`}>
      {kind === "stop" ? "If this stop fills: " : "If this target fills: "}
      {usd(move.usd)} ({move.pct >= 0 ? "+" : ""}
      {move.pct.toFixed(1)}%) on this position
    </p>
  );
}

/** Reward to risk for a bracket, with a gentle nudge when the target pays less than the stop risks. */
export function RewardRiskLine({ ratio }: { ratio: number | null }) {
  if (ratio === null) return null;
  return (
    <p className={`text-[11px] font-semibold ${ratio < 1 ? "text-amber-600 dark:text-amber-300" : "text-[var(--ink-muted)]"}`}>
      Reward to risk: {ratio.toFixed(2)} to 1{ratio < 1 ? ". The target makes less than the stop can lose." : ""}
    </p>
  );
}
