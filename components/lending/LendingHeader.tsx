"use client";

import React from "react";
import { RefreshCw } from "lucide-react";

interface LendingHeaderProps {
  topSupplyApy: number;
  lowestBorrowApr: number;
  totalLiquidityUsd: number;
  verifiedPoolsCount: number;
  lastUpdatedSecondsAgo?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function formatCompactUsd(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default function LendingHeader({
  topSupplyApy,
  lowestBorrowApr,
  totalLiquidityUsd,
  verifiedPoolsCount,
  lastUpdatedSecondsAgo = 0,
  onRefresh,
  isRefreshing = false,
}: LendingHeaderProps) {
  return (
    <div className="space-y-3">
      {/* Title & Live Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[var(--ink)] tracking-tight">
              Lend, Borrow &amp; Stake
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#0052FF]/10 text-[#0052FF] border border-[#0052FF]/20">
              Base 8453
            </span>
          </div>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">
            Borrow cash against tokenized stock collateral or supply assets for verified onchain yield.
          </p>
        </div>

        {/* Live Data Freshness Badge & Refresh button */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <div className="pop-pill flex items-center gap-2 px-2.5 py-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[11px] text-[var(--ink-muted)] font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Live · {lastUpdatedSecondsAgo}s ago</span>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="pop-pill p-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--brand)] transition cursor-pointer disabled:opacity-50"
              title="Refresh live rates"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin text-[var(--brand-text)]" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* Streamlined Stats Bar (Base Market Theme) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-2 sm:p-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs">
        <div className="px-3 py-1 flex flex-col justify-center">
          <span className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">
            Top Supply APY
          </span>
          <p className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
            {topSupplyApy > 0 ? `${topSupplyApy.toFixed(2)}%` : "—"}
          </p>
        </div>

        <div className="px-3 py-1 flex flex-col justify-center border-l border-[var(--border-subtle)]/60">
          <span className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">
            Lowest Borrow APR
          </span>
          <p className="text-base sm:text-lg font-black font-mono text-[var(--ink)]">
            {lowestBorrowApr > 0 ? `${lowestBorrowApr.toFixed(2)}%` : "—"}
          </p>
        </div>

        <div className="px-3 py-1 flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)]/60">
          <span className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">
            Total Liquidity
          </span>
          <p className="text-base sm:text-lg font-black font-mono text-[var(--ink)]">
            {formatCompactUsd(totalLiquidityUsd)}
          </p>
        </div>

        <div className="px-3 py-1 flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)]/60">
          <span className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">
            Verified Markets
          </span>
          <p className="text-base sm:text-lg font-black font-mono text-[#0052FF]">
            {verifiedPoolsCount} Pools
          </p>
        </div>
      </div>
    </div>
  );
}
