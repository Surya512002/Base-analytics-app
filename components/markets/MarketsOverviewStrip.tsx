"use client";

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  BarChart2,
  Lock,
  Info,
  RefreshCw,
  Clock,
  Layers,
} from "lucide-react";
import type { MarketsOverview, ActivitySeries, PricePoint } from "@/lib/markets/types";

interface MarketsOverviewStripProps {
  overview: MarketsOverview | null;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
  viewMode?: "activity" | "asset";
  onViewModeChange?: (mode: "activity" | "asset") => void;
}

function formatUsdLarge(val: number): string {
  if (val >= 1_000_000_000) {
    return `$${(val / 1_000_000_000).toFixed(2)}B`;
  }
  if (val >= 1_000_000) {
    return `$${(val / 1_000_000).toFixed(2)}M`;
  }
  if (val >= 1_000) {
    return `$${(val / 1_000).toFixed(1)}K`;
  }
  return `$${val.toLocaleString()}`;
}

export default function MarketsOverviewStrip({
  overview,
  loading = false,
  onRefresh,
  className = "",
  viewMode = "activity",
  onViewModeChange,
}: MarketsOverviewStripProps) {
  const [selectedRange, setSelectedRange] = useState<"1M" | "3M" | "All">("3M");
  const [activeSeriesIndex, setActiveSeriesIndex] = useState(0);
  const [hoveredPoint, setHoveredPoint] = useState<PricePoint | null>(null);

  const seriesList = overview?.series ?? [];
  const currentSeries: ActivitySeries | undefined = seriesList[activeSeriesIndex] ?? seriesList[0];

  // Slice series points according to selected range (1M = 30d, 3M = 91d, All = all)
  const chartPoints = useMemo(() => {
    if (!currentSeries?.points || currentSeries.points.length === 0) return [];
    const pts = currentSeries.points;
    if (selectedRange === "1M") return pts.slice(Math.max(0, pts.length - 30));
    if (selectedRange === "3M") return pts.slice(Math.max(0, pts.length - 91));
    return pts;
  }, [currentSeries, selectedRange]);

  // Compute SVG Area Path coordinates
  const { pathData, areaData } = useMemo(() => {
    if (chartPoints.length < 2) return { pathData: "", areaData: "" };
    const values = chartPoints.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const width = 600;
    const height = 140;
    const padding = 10;

    const coords = chartPoints.map((p, i) => {
      const x = padding + (i / (chartPoints.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((p.value - min) / range) * (height - 2 * padding);
      return { x, y };
    });

    const line = coords.reduce(
      (acc, c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`),
      ""
    );
    const area = `${line} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

    return { pathData: line, areaData: area };
  }, [chartPoints]);

  return (
    <div
      data-testid="markets-overview-strip"
      className={`rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 space-y-6 shadow-xs ${className}`}
    >
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center shrink-0">
            <BarChart2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[var(--ink)] tracking-tight">Base Markets</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0052FF]/10 text-[#0052FF] border border-[#0052FF]/20">
                Live Overview
              </span>
            </div>
            <p className="text-xs text-[var(--ink-muted)]">
              Tokenized equities, 24/7 DEX liquidity & on-chain lending protocols on Base
            </p>
          </div>
        </div>

        {/* Action Controls: View mode toggle & Freshness */}
        <div className="flex items-center flex-wrap gap-2 self-start sm:self-auto">
          {onViewModeChange && (
            <div className="p-0.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center text-xs font-semibold">
              <button
                type="button"
                onClick={() => onViewModeChange("activity")}
                className={`py-1.5 px-3 rounded-lg transition ${
                  viewMode === "activity"
                    ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                Activity
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("asset")}
                className={`py-1.5 px-3 rounded-lg transition ${
                  viewMode === "asset"
                    ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                By Asset
              </button>
            </div>
          )}

          {overview?.dataAsOf && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)] px-2.5 py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
              <Clock size={12} />
              <span>Data as of {new Date(overview.dataAsOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              {overview.isStale && (
                <span className="text-amber-500 font-bold ml-1">· Stale</span>
              )}
            </div>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-xl border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition disabled:opacity-50"
              title="Refresh market data"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* 3 Main Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Metric 1: 24h Stock Volume */}
        <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--ink-muted)]">
            <span className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-[#0052FF]" />
              24h Stock Volume
            </span>
            <div
              className="cursor-help"
              title="Sum of rolling 24-hour token volumes for stocks on the Base Liquid List (GeckoTerminal). Includes both trade legs for stock-to-stock trades; not issuer-wide deduplicated volume."
            >
              <Info size={13} className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition" />
            </div>
          </div>
          <div className="text-2xl font-black text-[var(--ink)] tabular-nums">
            {overview ? formatUsdLarge(overview.volume24h) : "—"}
          </div>
          <div className="text-[10px] text-[var(--ink-muted)] flex items-center gap-1">
            <span>Base Liquid List (DEX)</span>
          </div>
        </div>

        {/* Metric 2: Total Supplied */}
        <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--ink-muted)]">
            <span className="flex items-center gap-1.5">
              <Layers size={13} className="text-emerald-500" />
              Total Supplied
            </span>
            <div
              className="cursor-help"
              title="Value supplied to all Base lending markets. Impaired markets are left out. Vault deposits are not added on top."
            >
              <Info size={13} className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition" />
            </div>
          </div>
          <div className="text-2xl font-black text-[var(--ink)] tabular-nums text-emerald-600 dark:text-emerald-400">
            {overview ? formatUsdLarge(overview.totalSupplied) : "—"}
          </div>
          <div className="text-[10px] text-[var(--ink-muted)] flex items-center gap-1">
            <span>Morpho · Moonwell · Euler</span>
          </div>
        </div>

        {/* Metric 3: Total Borrowed */}
        <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--ink-muted)]">
            <span className="flex items-center gap-1.5">
              <Lock size={13} className="text-indigo-500" />
              Total Borrowed
            </span>
            <div
              className="cursor-help"
              title="Value borrowed from all Base lending markets. Impaired markets are left out."
            >
              <Info size={13} className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition" />
            </div>
          </div>
          <div className="text-2xl font-black text-[var(--ink)] tabular-nums text-indigo-600 dark:text-indigo-400">
            {overview ? formatUsdLarge(overview.totalBorrowed) : "—"}
          </div>
          <div className="text-[10px] text-[var(--ink-muted)] flex items-center gap-1">
            <span>Active DeFi loans on Base</span>
          </div>
        </div>
      </div>

      {/* Interactive Mini Chart Section */}
      {seriesList.length > 0 && (
        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Series Tab selector */}
            <div className="flex items-center gap-1">
              {seriesList.map((s, idx) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setActiveSeriesIndex(idx);
                    setHoveredPoint(null);
                  }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition ${
                    activeSeriesIndex === idx
                      ? "bg-[var(--brand)] text-white shadow-xs"
                      : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                  }`}
                >
                  {s.label.split(",")[0]}
                </button>
              ))}
            </div>

            {/* Time range selector (1M / 3M / All) */}
            <div className="p-0.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center text-xs font-bold self-start sm:self-auto">
              {(["1M", "3M", "All"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRange(r)}
                  className={`py-1 px-2.5 rounded-lg transition ${
                    selectedRange === r
                      ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Display Canvas */}
          <div className="relative w-full h-[150px] rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] p-3 overflow-hidden">
            {chartPoints.length > 1 ? (
              <>
                <svg
                  viewBox="0 0 600 140"
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0052FF" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#0052FF" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Shaded Area */}
                  <path d={areaData} fill="url(#chartGradient)" />

                  {/* Stroke Line */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#0052FF"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                {/* Range Labels */}
                <div className="absolute bottom-2 left-4 right-4 flex justify-between text-[10px] text-[var(--ink-muted)] tabular-nums pointer-events-none">
                  <span>{chartPoints[0]?.date}</span>
                  <span className="font-semibold text-[var(--brand-text)]">
                    {hoveredPoint
                      ? `${hoveredPoint.date}: ${formatUsdLarge(hoveredPoint.value)}`
                      : `Latest: ${formatUsdLarge(chartPoints[chartPoints.length - 1]?.value ?? 0)}`}
                  </span>
                  <span>{chartPoints[chartPoints.length - 1]?.date}</span>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[var(--ink-muted)]">
                Loading activity history…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
