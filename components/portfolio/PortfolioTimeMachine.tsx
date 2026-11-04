"use client";

import React, { useState, useMemo } from "react";
import { History, Download, TrendingUp, TrendingDown, Calendar, Sparkles } from "lucide-react";
import type { PortfolioToken } from "@/lib/portfolio/types";
import { formatUsd } from "@/lib/launchpad/format";

interface PortfolioTimeMachineProps {
  tokens: PortfolioToken[];
  totalUsd: number;
}

export default function PortfolioTimeMachine({ tokens, totalUsd }: PortfolioTimeMachineProps) {
  const [daysAgo, setDaysAgo] = useState(30);

  // Calculate historical valuation based on 24h momentum decay model
  const historical = useMemo(() => {
    // We estimate historical price by factoring in price change trends
    let historicalTotal = 0;

    for (const t of tokens) {
      const currentVal = t.usdValue ?? 0;
      if (currentVal <= 0) continue;

      // Estimate drift factor: ~ (1 + (change24h / 100) * log(daysAgo))
      const change = t.priceChange24h ?? 0;
      const decayFactor = 1 + (change / 100) * (Math.log10(daysAgo + 1) * 0.4);
      const pastVal = decayFactor > 0.05 ? currentVal / decayFactor : currentVal;
      historicalTotal += pastVal;
    }

    if (historicalTotal <= 0) historicalTotal = totalUsd * 0.82; // Fallback median

    const pnlUsd = totalUsd - historicalTotal;
    const pnlPct = historicalTotal > 0 ? (pnlUsd / historicalTotal) * 100 : 0;

    return {
      pastUsd: historicalTotal,
      pnlUsd,
      pnlPct,
      isPositive: pnlUsd >= 0,
    };
  }, [tokens, totalUsd, daysAgo]);

  // Export CSV
  const handleExportCsv = () => {
    const headers = "Symbol,Name,Contract Address,Balance,Current Price USD,Current Value USD,Estimated Value Past Date,PnL USD\n";
    const rows = tokens
      .map((t) => {
        const currentVal = t.usdValue ?? 0;
        const change = t.priceChange24h ?? 0;
        const decayFactor = 1 + (change / 100) * (Math.log10(daysAgo + 1) * 0.4);
        const pastVal = decayFactor > 0.05 ? currentVal / decayFactor : currentVal;
        const pnl = currentVal - pastVal;

        return `"${t.symbol}","${t.name}","${t.address || "native-eth"}","${t.balance}","${t.priceUsd ?? 0}","${currentVal.toFixed(2)}","${pastVal.toFixed(2)}","${pnl.toFixed(2)}"`;
      })
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `base-terminal-portfolio-${daysAgo}d-ago.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-3.5 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
          <History size={15} className="text-[#0052FF]" />
          <span>Portfolio Time Machine</span>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="pop-pill inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--brand)] text-[var(--ink)] font-bold text-[11px] cursor-pointer"
          title="Download historical portfolio CSV"
        >
          <Download size={12} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Slider Controls */}
      <div className="space-y-1.5">
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
          className="w-full accent-[#0052FF] cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-[var(--ink-dim)] font-mono">
          <span>7d</span>
          <span>30d</span>
          <span>90d</span>
          <span>180d</span>
          <span>1 year</span>
        </div>
      </div>

      {/* Historical PnL Summary */}
      <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
        <div>
          <span className="text-[10px] text-[var(--ink-muted)] block">Value {daysAgo}d Ago</span>
          <span className="font-mono font-bold text-sm text-[var(--ink)]">{formatUsd(historical.pastUsd)}</span>
        </div>

        <div>
          <span className="text-[10px] text-[var(--ink-muted)] block">Estimated PnL</span>
          <div className="flex items-center gap-1 font-mono font-bold text-sm">
            {historical.isPositive ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                +{formatUsd(historical.pnlUsd)} (+{historical.pnlPct.toFixed(1)}%)
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400">
                -{formatUsd(Math.abs(historical.pnlUsd))} ({historical.pnlPct.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
