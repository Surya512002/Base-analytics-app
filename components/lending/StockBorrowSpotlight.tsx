"use client";

import {
  TrendingUp,
  ShieldCheck,
  Coins,
  Sparkles,
  ArrowRight,
  BarChart2,
  Lock,
} from "lucide-react";

export default function StockBorrowSpotlight({
  onSelectFilter,
}: {
  onSelectFilter: (category: string) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-blue-950/20 via-[var(--surface)] to-emerald-950/20 p-5 sm:p-6 shadow-[var(--shadow-card)]">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
              <Sparkles size={12} />
              TOKENIZED STOCKS &amp; RWAs HUB
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--surface-2)] text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
              <ShieldCheck size={12} className="text-emerald-500" />
              Verified Contracts · Base Mainnet
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)]">
            Borrow against Stocks &amp; Earn Yield on Base
          </h2>

          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            Deposit Coinbase B20 tokenized stocks (<strong className="text-[var(--ink)]">NVDAc, AAPLc, TSLAc, COINc</strong>) as collateral to borrow USDC at sub-3% rates without triggering capital gains taxes. Plus lend stocks for up to 11.2% APY or stake LP in Aerodrome gauges.
          </p>

          {/* Quick Value Props */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="pop rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]/80 p-2.5">
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-bold mb-1">
                <Lock size={12} />
                <span className="tabular-nums">Up to 78% LTV</span>
              </div>
              <p className="text-[11px] text-[var(--ink-muted)]">Instant USDC loans against top equities</p>
            </div>

            <div className="pop rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]/80 p-2.5">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-bold mb-1">
                <TrendingUp size={12} />
                <span className="tabular-nums">11.2% Stock APY</span>
              </div>
              <p className="text-[11px] text-[var(--ink-muted)]">Securities lending to market makers</p>
            </div>

            <div className="pop rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]/80 p-2.5">
              <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 text-xs font-bold mb-1">
                <Coins size={12} />
                <span className="tabular-nums">38.5% Gauge APR</span>
              </div>
              <p className="text-[11px] text-[var(--ink-muted)]">Aerodrome stock CL LP gauges</p>
            </div>

            <div className="pop rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]/80 p-2.5">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold mb-1">
                <ShieldCheck size={12} />
                <span>Chainlink 24/5</span>
              </div>
              <p className="text-[11px] text-[var(--ink-muted)]">Official on-chain equity price feeds</p>
            </div>
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-row lg:flex-col gap-2.5 w-full lg:w-48 shrink-0">
          <button
            type="button"
            onClick={() => onSelectFilter("stocks_borrow")}
            className="flex-1 btn-primary py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <span>Borrow on Stocks</span>
            <ArrowRight size={13} />
          </button>

          <button
            type="button"
            onClick={() => onSelectFilter("stocks_lend")}
            className="pop-pill flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--ink)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <BarChart2 size={13} className="text-emerald-700 dark:text-emerald-400" />
            <span>Lend Stocks</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectFilter("stocks_stake")}
            className="pop-pill flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--ink)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Coins size={13} className="text-purple-600 dark:text-purple-400" />
            <span>Stock Gauges</span>
          </button>
        </div>
      </div>
    </div>
  );
}
