"use client";

import { useMemo } from "react";
import type { RecentSwapRow } from "@/lib/api/launchpad-token-client";

export default function TokenPriceChart({
  swaps,
  loading,
}: {
  swaps: RecentSwapRow[];
  loading?: boolean;
}) {
  const points = useMemo(() => {
    const withPrice = swaps
      .filter((s) => s.priceUsd != null && s.priceUsd > 0)
      .slice()
      .reverse();
    if (withPrice.length < 2) return [];
    return withPrice.map((s, i) => ({
      x: i,
      y: s.priceUsd!,
      t: s.timestamp,
    }));
  }, [swaps]);

  if (loading) {
    return (
      <div className="h-48 rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
    );
  }

  if (points.length < 2) {
    return (
      <div className="h-48 rounded-2xl border border-white/10 bg-white/[0.02] flex items-center justify-center text-sm text-slate-500">
        Not enough swap data for a chart yet
      </div>
    );
  }

  const w = 600;
  const h = 180;
  const pad = 8;
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = maxY - minY || maxY * 0.01;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.y - minY) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const first = points[0]!.y;
  const last = points[points.length - 1]!.y;
  const change = ((last - first) / first) * 100;
  const up = change >= 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Price from recent swaps
        </p>
        <span
          className={`text-xs font-black font-mono ${up ? "text-emerald-400" : "text-rose-400"}`}
        >
          {up ? "+" : ""}
          {change.toFixed(2)}%
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? "#10b981" : "#f43f5e"} stopOpacity="0.25" />
            <stop offset="100%" stopColor={up ? "#10b981" : "#f43f5e"} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          fill="url(#chartFill)"
          points={`${pad},${h - pad} ${coords.join(" ")} ${w - pad},${h - pad}`}
        />
        <polyline
          fill="none"
          stroke={up ? "#34d399" : "#fb7185"}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={coords.join(" ")}
        />
      </svg>
      <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2">
        <span>${minY < 0.01 ? minY.toExponential(2) : minY.toFixed(4)}</span>
        <span>${last < 0.01 ? last.toExponential(2) : last.toFixed(4)}</span>
      </div>
    </div>
  );
}
