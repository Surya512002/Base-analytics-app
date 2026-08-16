"use client";

import { Activity, Radio } from "lucide-react";

export default function LiveMarketStrip({
  b20Live,
  volume24h,
  syncing,
}: {
  tokenCount?: number;
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
    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-2">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1">
        <span className="relative flex h-2 w-2">
          {!syncing && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
          )}
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
        </span>
        <span className="text-[10px] font-black uppercase tracking-wider text-rose-200">Live</span>
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-2.5 py-1">
        <Radio size={10} className="text-[var(--ink-muted)]" />
        <span className="text-[10px] font-bold text-[var(--ink-muted)]">Base mainnet</span>
      </div>
      {volLabel && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
          <Activity size={10} className="text-emerald-400" />
          <span className="text-[10px] font-bold text-slate-300">{volLabel}</span>
        </div>
      )}
      {b20Live !== false && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1">
          <span className="text-[10px] font-bold text-emerald-300">B20 factory active</span>
        </div>
      )}
    </div>
  );
}
