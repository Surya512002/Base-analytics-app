"use client";

import React from "react";
import { TrendingUp, RefreshCw, ShieldCheck, Coins, Lock, Info } from "lucide-react";

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
    <div className="space-y-4">
      {/* Title & One-line Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)] text-xs font-bold mb-1.5">
            <TrendingUp size={13} />
            <span>Base Mainnet Equities &amp; Money Markets</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--ink)] tracking-tight">
            Lend, Borrow &amp; Stake
          </h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1 max-w-2xl">
            Borrow cash against tokenized stock collateral while maintaining equity exposure, or supply assets for verified onchain yield.
          </p>
        </div>

        {/* Live Data Freshness Badge & Refresh button */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <div className="pop-pill flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--ink-muted)] font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Live · updated {lastUpdatedSecondsAgo}s ago</span>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="pop-pill p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--brand)] transition cursor-pointer disabled:opacity-50"
              title="Refresh live rates"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin text-[var(--brand-text)]" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* Live Calculated Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
        <div className="pop p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--ink-muted)] uppercase tracking-wider block">
            Top Supply APY
          </span>
          <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
            {topSupplyApy > 0 ? `${topSupplyApy.toFixed(2)}%` : "—"}
          </p>
          <span className="text-[10px] text-[var(--ink-dim)]">Securities yield on Base</span>
        </div>

        <div className="pop p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--ink-muted)] uppercase tracking-wider block">
            Lowest Borrow APR
          </span>
          <p className="text-lg font-black font-mono text-[var(--ink)] mt-0.5">
            {lowestBorrowApr > 0 ? `${lowestBorrowApr.toFixed(2)}%` : "—"}
          </p>
          <span className="text-[10px] text-[var(--ink-dim)]">USDC against stock collateral</span>
        </div>

        <div className="pop p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--ink-muted)] uppercase tracking-wider block">
            Total Liquidity
          </span>
          <p className="text-lg font-black font-mono text-[var(--ink)] mt-0.5">
            {formatCompactUsd(totalLiquidityUsd)}
          </p>
          <span className="text-[10px] text-[var(--ink-dim)]">Across verified Base protocols</span>
        </div>

        <div className="pop p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
          <span className="text-[11px] font-bold text-[var(--ink-muted)] uppercase tracking-wider block">
            Verified Markets
          </span>
          <p className="text-lg font-black font-mono text-[var(--brand-text)] mt-0.5">
            {verifiedPoolsCount} Pools
          </p>
          <span className="text-[10px] text-[var(--ink-dim)]">Beefy, Aerodrome, Aave &amp; IPOR</span>
        </div>
      </div>

      {/* Neutral disclaimer line */}
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-dim)] pt-0.5">
        <Info size={12} className="shrink-0" />
        <span>Rates and terms vary; this is not financial or tax advice. Market terms depend on protocol liquidity parameters.</span>
      </div>
    </div>
  );
}
