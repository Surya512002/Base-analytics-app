"use client";

import { Lock, RefreshCcw, Zap } from "lucide-react";
import { getX402Product } from "@/lib/constants/x402-products";

export default function AnalyticsPaywall({
  unlocked,
  unlockLoading,
  onUnlock,
  children,
}: {
  unlocked: boolean;
  unlockLoading?: boolean;
  onUnlock: () => void;
  children: React.ReactNode;
}) {
  const product = getX402Product("analytics");

  return (
    <div className="relative w-full">
      <div
        className={`w-full transition-[filter] duration-300 ${
          unlocked ? "" : "blur-md pointer-events-none select-none"
        }`}
      >
        {children}
      </div>

      {!unlocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-[var(--bg-deep)]/80 backdrop-blur-[2px] p-4">
          <div className="max-w-sm w-full glass-panel border border-[var(--border-strong)] rounded-2xl p-6 text-center shadow-2xl shadow-black/40">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-4">
              <Lock size={22} className="text-[var(--ink-muted)]" />
            </div>
            <p className="text-[10px] font-black text-[var(--ink-muted)] uppercase tracking-widest">
              x402 · Base mainnet
            </p>
            <h4 className="text-lg font-black text-white mt-2">Unlock Onchain Analytics</h4>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Pay once to view your onchain score, activity heatmap, and wallet health status —
              like Farcaster analysis.
            </p>
            <p className="text-2xl font-black text-white mt-4 tabular-nums">{product.priceDisplay} USDC</p>
            <p className="text-[11px] text-slate-500 mt-1">via x402 on Base · persists until disconnect</p>
            <button
              type="button"
              onClick={onUnlock}
              disabled={unlockLoading}
              className="w-full mt-5 py-3.5 rounded-xl font-black text-sm btn-primary text-white disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
            >
              {unlockLoading ? (
                <>
                  <RefreshCcw size={16} className="animate-spin" />
                  Confirming payment…
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Pay {product.amountLabel} to unlock
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-600 mt-3 leading-relaxed">
              Disconnecting clears unlock — reconnect and pay again to view analytics.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
