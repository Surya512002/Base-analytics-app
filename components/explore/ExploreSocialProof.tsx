"use client";

import { Activity, Layers, Rocket, TrendingUp } from "lucide-react";
import { formatUsd } from "@/lib/launchpad/format";

export default function ExploreSocialProof({
  tokenCount,
  volume24h,
  liquidity,
  launchesWeek,
  swaps24h,
  loading,
  syncing,
}: {
  tokenCount: number;
  volume24h?: number;
  liquidity?: number;
  launchesWeek?: number;
  swaps24h?: number;
  loading?: boolean;
  syncing?: boolean;
}) {
  const showPlaceholder = loading && tokenCount === 0;
  const stats = [
    {
      icon: <Layers size={14} />,
      label: "Tradable",
      value: showPlaceholder ? "…" : String(tokenCount),
    },
    {
      icon: <TrendingUp size={14} />,
      label: "24h volume",
      value: showPlaceholder ? "…" : volume24h && volume24h > 0 ? formatUsd(volume24h) : "—",
    },
    {
      icon: <Activity size={14} />,
      label: "Pool liquidity",
      value: showPlaceholder ? "…" : liquidity && liquidity > 0 ? formatUsd(liquidity) : "—",
    },
    {
      icon: <Rocket size={14} />,
      label: "Launches (7d)",
      value: showPlaceholder ? "…" : launchesWeek != null ? String(launchesWeek) : "—",
    },
    {
      icon: <Activity size={14} className="text-emerald-400" />,
      label: "Swaps (24h)",
      value: showPlaceholder ? "…" : swaps24h != null ? String(swaps24h) : "—",
    },
  ];

  return (
    <div className="relative">
      {syncing && (
        <span className="absolute -top-1 right-0 text-[9px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
          Updating…
        </span>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/[0.08] bg-[var(--bg-raised)] px-3 py-2.5 sm:py-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-dim)] flex items-center gap-1.5">
              {s.icon}
              {s.label}
            </p>
            <p className="text-base sm:text-lg font-bold text-[var(--ink)] font-mono mt-1 tabular-nums min-w-[2ch]">
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
