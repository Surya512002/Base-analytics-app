"use client";

import { Activity, Radio } from "lucide-react";

export default function LiveMarketStrip({
  tokenCount,
  b20Live,
  volume24h,
  syncing,
}: {
  tokenCount: number;
  b20Live?: boolean;
  volume24h?: number;
  syncing?: boolean;
}) {
  const volLabel =
    volume24h && volume24h > 0
      ? volume24h >= 1e6
        ? `$${(volume24h / 1e6).toFixed(1)}M vol`
        : `$${(volume24h / 1e3).toFixed(0)}K vol`
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-2 animate-meridian-fade">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1">
        <span className="live-dot" style={{ width: 6, height: 6 }} />
        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 dark:text-emerald-400">
          Live
        </span>
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-1">
        <Radio size={11} className="text-[var(--brand)]" />
        <span className="text-[10px] font-bold text-[var(--ink-muted)]">Base mainnet · 8453</span>
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-1">
        <Activity size={11} className="text-emerald-500 dark:text-emerald-400" />
        <span className="text-[10px] font-bold text-[var(--ink)]">
          <span className="font-mono tabular-nums inline-block font-bold">{tokenCount}</span>{" "}
          <span className="text-[var(--ink-muted)]">tradable{volLabel ? ` · ${volLabel}` : ""}</span>
        </span>
      </div>
      {b20Live !== false && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1">
          <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400">
            B20 factory active
          </span>
        </div>
      )}
    </div>
  );
}
