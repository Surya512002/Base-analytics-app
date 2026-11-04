"use client";

import React, { useState, useMemo } from "react";
import { History, Download, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import type { PortfolioToken } from "@/lib/portfolio/types";
import { formatUsd } from "@/lib/launchpad/format";
import { FEATURES } from "@/lib/constants/features";
import {
  computeHistoricalValuation,
  generateTaxFriendlyCsv,
} from "@/lib/portfolio/time-machine-math";

interface PortfolioTimeMachineProps {
  tokens: PortfolioToken[];
  totalUsd: number;
  className?: string;
}

const LOOKBACK_PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1 Year", days: 365 },
] as const;

export default function PortfolioTimeMachine({
  tokens,
  totalUsd,
  className = "",
}: PortfolioTimeMachineProps) {
  const [daysAgo, setDaysAgo] = useState<number>(30);

  // Extract ETH price change from tokens if present, or fallback to zero
  const ethToken = tokens.find(
    (t) => t.symbol === "ETH" || t.symbol === "WETH" || t.address === "0x4200000000000000000000000000000000000006"
  );
  const ethPriceChange24h = ethToken?.priceChange24h ?? 2.5;

  const report = useMemo(() => {
    return computeHistoricalValuation({
      tokens,
      daysAgo,
      ethPriceChange24h,
    });
  }, [tokens, daysAgo, ethPriceChange24h]);

  // Feature flag check
  if (!FEATURES.PORTFOLIO_TIME_MACHINE) {
    return null;
  }

  // Export CSV
  const handleExportCsv = () => {
    const csvContent = generateTaxFriendlyCsv({ tokens, daysAgo });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `base-terminal-tax-report-${daysAgo}d-lookback.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      data-testid="portfolio-time-machine"
      className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 sm:p-5 space-y-4 text-xs ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)]">
            <History size={16} />
          </div>
          <div>
            <span className="font-bold text-sm text-[var(--ink)] block">Portfolio Time Machine</span>
            <span className="text-[11px] text-[var(--ink-muted)]">
              Historical valuation &amp; &apos;What if you held ETH?&apos; benchmark
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={tokens.length === 0}
          className="pop-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--brand)] text-[var(--ink)] font-bold text-xs cursor-pointer transition disabled:opacity-50"
          title="Download tax-friendly portfolio CSV"
        >
          <Download size={13} className="text-[var(--brand-text)]" />
          <span>Export Tax CSV</span>
        </button>
      </div>

      {/* Preset Pill Buttons */}
      <div className="flex items-center gap-2">
        {LOOKBACK_PRESETS.map((preset) => {
          const isActive = daysAgo === preset.days;
          return (
            <button
              key={preset.days}
              type="button"
              onClick={() => setDaysAgo(preset.days)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                isActive
                  ? "bg-[var(--brand)] text-white shadow-xs"
                  : "bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Slider Horizon Controls */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
          <span>Lookback Horizon</span>
          <span className="font-mono font-bold text-[var(--ink)]">{daysAgo} days ago</span>
        </div>
        <input
          type="range"
          min={7}
          max={365}
          step={7}
          value={daysAgo}
          onChange={(e) => setDaysAgo(Number(e.target.value))}
          className="w-full accent-[var(--brand)] cursor-pointer h-1.5 bg-[var(--border-subtle)] rounded-lg"
          aria-label="Lookback horizon in days"
        />
      </div>

      {/* Report Metrics */}
      {!report ? (
        <div className="p-4 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface)] text-center text-xs text-[var(--ink-muted)]">
          <p className="font-bold text-[var(--ink)]">No Historical Pricing Available</p>
          <p className="text-[11px] mt-1">
            Current portfolio balance (${totalUsd.toLocaleString()}) does not contain priced tokens.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Historical PnL Summary */}
          <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div>
              <span className="text-[10px] text-[var(--ink-muted)] block">Est. Value {daysAgo}d Ago</span>
              <span className="font-mono font-bold text-sm text-[var(--ink)]">
                {formatUsd(report.pastTotalUsd)}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-[var(--ink-muted)] block">Portfolio PnL</span>
              <div className="flex items-center gap-1 font-mono font-bold text-sm">
                {report.isPositive ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp size={14} />
                    +{formatUsd(report.pnlUsd)} (+{report.pnlPct.toFixed(1)}%)
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                    <TrendingDown size={14} />
                    -{formatUsd(Math.abs(report.pnlUsd))} ({report.pnlPct.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* "What If You Held ETH?" Benchmark */}
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--ink)] flex items-center gap-1">
                <Sparkles size={12} className="text-[var(--brand-text)]" />
                What If You Held ETH Benchmark:
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  report.ethBenchmark.beatsEth
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {report.ethBenchmark.beatsEth
                  ? `+${report.ethBenchmark.outperformancePct}% vs ETH`
                  : `${report.ethBenchmark.outperformancePct}% vs ETH`}
              </span>
            </div>

            <p className="text-[11px] text-[var(--ink-muted)]">
              Holding 100% ETH would be worth{" "}
              <strong className="text-[var(--ink)] font-mono">
                {formatUsd(report.ethBenchmark.ethCurrentValuationUsd)}
              </strong>{" "}
              today ({report.ethBenchmark.ethPnlPct >= 0 ? "+" : ""}
              {report.ethBenchmark.ethPnlPct}%).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
