"use client";

import { BarChart3, RefreshCcw } from "lucide-react";

export default function AnalyticsLoadingPanel({
  scanProgress,
  walletRefreshing,
}: {
  scanProgress?: string;
  walletRefreshing?: boolean;
}) {
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
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
          {["Score", "Heatmap", "Swaps", "Health"].map((label) => (
            <div
              key={label}
              className="h-12 rounded-xl bg-white/[0.03] border border-white/8 animate-pulse"
              aria-hidden
            />
          ))}
        </div>
      </div>
    </div>
  );
}
