"use client";

import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, Droplets, ShieldCheck, Zap } from "lucide-react";
import type { StockMarketItem } from "@/lib/markets/types";

function formatUsdDisplay(val: number | null | undefined): string {
  if (val == null || !Number.isFinite(val) || val <= 0) return "—";
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

interface MoversSignalsStripProps {
  stocks: StockMarketItem[];
  loading?: boolean;
  onSelectStock?: (stock: StockMarketItem) => void;
}

interface SignalItem {
  key: string;
  badge: string;
  icon: React.ReactNode;
  stock: StockMarketItem;
  metricLabel: string;
  metricValue: string;
  metricColor: string;
  bgGradient: string;
}

export default function MoversSignalsStrip({
  stocks,
  loading = false,
  onSelectStock,
}: MoversSignalsStripProps) {
  const signals = useMemo<SignalItem[]>(() => {
    if (!stocks || stocks.length === 0) return [];

    const activeStocks = stocks.filter((s) => s.status !== "deprecated");
    const result: SignalItem[] = [];

    // 1. Top Gainer (highest change24h)
    const sortedByGain = [...activeStocks].sort((a, b) => b.change24h - a.change24h);
    const topGainer = sortedByGain.find((s) => s.change24h > 0);
    if (topGainer) {
      result.push({
        key: "top-gainer",
        badge: "Top Gainer",
        icon: <TrendingUp size={13} className="text-emerald-500" />,
        stock: topGainer,
        metricLabel: "24h Gain",
        metricValue: `+${topGainer.change24h.toFixed(2)}%`,
        metricColor: "text-emerald-600 dark:text-emerald-400",
        bgGradient: "from-emerald-500/10 via-transparent to-transparent",
      });
    }

    // 2. Most Liquid (highest tradingLiquidity)
    const sortedByLiquidity = [...activeStocks].sort(
      (a, b) => b.tradingLiquidity - a.tradingLiquidity
    );
    const mostLiquid = sortedByLiquidity[0];
    if (mostLiquid && mostLiquid.tradingLiquidity > 0) {
      result.push({
        key: "most-liquid",
        badge: "Most Liquid",
        icon: <Droplets size={13} className="text-[#0052FF]" />,
        stock: mostLiquid,
        metricLabel: "Pool Liquidity",
        metricValue: formatUsdDisplay(mostLiquid.tradingLiquidity),
        metricColor: "text-[#0052FF] dark:text-blue-400",
        bgGradient: "from-blue-500/10 via-transparent to-transparent",
      });
    }

    // 3. Most Used as Collateral (highest usedAsCollateral)
    const sortedByCollateral = [...activeStocks].sort(
      (a, b) => (b.usedAsCollateral ?? 0) - (a.usedAsCollateral ?? 0)
    );
    const topCollateral = sortedByCollateral[0];
    if (topCollateral && (topCollateral.usedAsCollateral ?? 0) > 0) {
      result.push({
        key: "top-collateral",
        badge: "Top Collateral",
        icon: <ShieldCheck size={13} className="text-purple-500" />,
        stock: topCollateral,
        metricLabel: "In DeFi Lending",
        metricValue: formatUsdDisplay(topCollateral.usedAsCollateral),
        metricColor: "text-purple-600 dark:text-purple-400",
        bgGradient: "from-purple-500/10 via-transparent to-transparent",
      });
    }

    // 4. Lowest Price Impact on $10K
    const validImpactStocks = activeStocks.filter(
      (s) => s.priceImpact10k != null && s.priceImpact10k > 0 && s.tradingLiquidity > 50000
    );
    const sortedByImpact = [...validImpactStocks].sort(
      (a, b) => (a.priceImpact10k ?? 999) - (b.priceImpact10k ?? 999)
    );
    const lowestImpact = sortedByImpact[0];
    if (lowestImpact && lowestImpact.priceImpact10k != null) {
      result.push({
        key: "lowest-impact",
        badge: "Lowest $10K Impact",
        icon: <Zap size={13} className="text-amber-500" />,
        stock: lowestImpact,
        metricLabel: "Impact on $10K",
        metricValue: `${lowestImpact.priceImpact10k.toFixed(2)}%`,
        metricColor: "text-amber-600 dark:text-amber-400",
        bgGradient: "from-amber-500/10 via-transparent to-transparent",
      });
    }

    // 5. Top Dip / Rebound Candidate (lowest negative change24h)
    const sortedByDip = [...activeStocks].sort((a, b) => a.change24h - b.change24h);
    const topDip = sortedByDip.find((s) => s.change24h < 0);
    if (topDip && topDip.symbol !== topGainer?.symbol) {
      result.push({
        key: "top-dip",
        badge: "24h Pullback",
        icon: <TrendingDown size={13} className="text-rose-500" />,
        stock: topDip,
        metricLabel: "24h Change",
        metricValue: `${topDip.change24h.toFixed(2)}%`,
        metricColor: "text-rose-600 dark:text-rose-400",
        bgGradient: "from-rose-500/10 via-transparent to-transparent",
      });
    }

    return result;
  }, [stocks]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] skeleton-shimmer"
          />
        ))}
      </div>
    );
  }

  if (signals.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-[var(--ink)] tracking-tight">
            Market Signals & Key Movers
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#0052FF]/10 text-[#0052FF] font-mono">
            Live On-Chain
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {signals.map((sig) => (
          <button
            key={sig.key}
            type="button"
            onClick={() => onSelectStock?.(sig.stock)}
            className={`pop-pill text-left p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-2)] bg-gradient-to-b ${sig.bgGradient} transition-all shadow-xs group cursor-pointer flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between w-full mb-1.5">
              <span className="text-[10px] font-bold text-[var(--ink-muted)] flex items-center gap-1">
                {sig.icon}
                <span>{sig.badge}</span>
              </span>
              <span className="text-[10px] font-mono text-[var(--ink-muted)] group-hover:text-[var(--ink)] transition">
                →
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-sm text-[var(--ink)]">
                  {sig.stock.symbol}
                </span>
                <span className="text-[10px] text-[var(--ink-muted)] truncate max-w-[80px]">
                  {sig.stock.name}
                </span>
              </div>

              <div className="flex items-baseline justify-between mt-1 text-[11px]">
                <span className="text-[10px] text-[var(--ink-muted)]">
                  {sig.metricLabel}
                </span>
                <span className={`font-mono font-bold ${sig.metricColor} tabular-nums`}>
                  {sig.metricValue}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
