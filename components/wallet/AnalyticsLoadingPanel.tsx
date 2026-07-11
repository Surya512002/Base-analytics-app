"use client";

import { BarChart3, RefreshCcw } from "lucide-react";

const SYNC_STAGES = ["Score", "Heatmap", "Swaps", "Health"] as const;

function stageIndex(progress?: string): number {
  if (!progress) return 0;
  const p = progress.toLowerCase();
  if (p.includes("heatmap") || p.includes("history") || p.includes("active days")) return 2;
  if (p.includes("swap") || p.includes("volume")) return 3;
  if (p.includes("health") || p.includes("complete")) return 4;
  if (p.includes("score") || p.includes("calculating")) return 1;
  return 1;
}

export default function AnalyticsLoadingPanel({
  scanProgress,
  walletRefreshing,
}: {
  scanProgress?: string;
  walletRefreshing?: boolean;
}) {
  const activeStage = stageIndex(scanProgress);
  const pct = Math.min(95, Math.max(12, activeStage * 22));

  return (
    <div className="editorial-hero overflow-hidden">
      <div className="accent-bar" />
      <div className="p-8 sm:p-12 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-5">
          {walletRefreshing ? (
            <RefreshCcw size={28} className="text-white/60 animate-spin" />
          ) : (
            <BarChart3 size={28} className="text-white/60" />
          )}
        </div>
        <h2 className="text-xl font-black text-white mb-2">Fetching wallet analytics</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          Indexing your Base history, score, heatmap, and swap volume. You can launch tokens,
          trade, and use vouchers while this loads.
        </p>
        {(scanProgress || walletRefreshing) && (
          <p className="mt-4 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
            {scanProgress || "Syncing onchain data…"}
          </p>
        )}
        <div className="mt-5 max-w-md mx-auto">
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-[#0052FF] to-emerald-400 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] text-slate-500 font-mono">{pct}% indexed</p>
        </div>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
          {SYNC_STAGES.map((label, i) => {
            const done = i < activeStage;
            const current = i === activeStage - 1 || (activeStage === 0 && i === 0);
            return (
              <div
                key={label}
                className={`h-12 rounded-xl border flex items-center justify-center text-[10px] font-bold uppercase tracking-wide ${
                  done
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                    : current
                      ? "bg-white/[0.05] border-[#0052FF]/40 text-white animate-pulse"
                      : "bg-white/[0.03] border-white/8 text-slate-600"
                }`}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
