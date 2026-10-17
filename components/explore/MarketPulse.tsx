"use client";

import React from "react";
import { formatCompactUsd } from "@/lib/explore/explore-config";

interface MarketPulseProps {
  tradableTokensCount: number;
  b20LiveCount: number;
  totalVolume24h: number;
  totalLiquidity: number;
  lastUpdatedSecondsAgo?: number;
  syncing?: boolean;
}

export default function MarketPulse({
  tradableTokensCount,
  b20LiveCount,
  totalVolume24h,
  totalLiquidity,
  lastUpdatedSecondsAgo = 0,
  syncing = false,
}: MarketPulseProps) {
  return (
    <div className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 sm:p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-6 text-xs">
        {/* Live Status & Network */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="pop flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>{syncing ? "Syncing…" : `Live · updated ${lastUpdatedSecondsAgo}s ago`}</span>
          </div>

          <div className="flex items-center gap-1 text-[var(--ink-muted)] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF]" />
            <span>Base Mainnet</span>
          </div>
        </div>

        {/* Fact Strip: Each fact shown once */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          <div className="pop flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]">
            <span className="text-[var(--ink-muted)]">Tradable tokens:</span>
            <span className="font-mono font-bold text-[var(--ink)] tabular-nums">
              {tradableTokensCount.toLocaleString()}
            </span>
          </div>

          <div className="pop flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]">
            <span className="text-[var(--ink-muted)]">B20 live:</span>
            <span className="font-mono font-bold text-[var(--ink)] tabular-nums">
              {b20LiveCount > 0 ? b20LiveCount : "Active"}
            </span>
          </div>

          <div className="pop flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]">
            <span className="text-[var(--ink-muted)]">24h volume:</span>
            <span className="font-mono font-bold text-[var(--ink)] tabular-nums">
              {formatCompactUsd(totalVolume24h)}
            </span>
          </div>

          <div className="pop flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]">
            <span className="text-[var(--ink-muted)]">Pool liquidity:</span>
            <span className="font-mono font-bold text-[var(--ink)] tabular-nums">
              {formatCompactUsd(totalLiquidity)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
