"use client";

import { Lock, RefreshCcw, Zap } from "lucide-react";
import { getX402Product } from "@/lib/constants/x402-products";
import AnalyticsLoadingPanel from "@/components/wallet/AnalyticsLoadingPanel";

/** Decorative placeholders only — no real wallet metrics when locked. */
function LockedAnalyticsSilhouette() {
  return (
    <div className="space-y-4 select-none pointer-events-none" aria-hidden>
      <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white h-48" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]"
          />
        ))}
      </div>
      <div className="h-28 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]" />
      <div className="h-56 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-raised)]" />
    </div>
  );
}

export default function AnalyticsPaywall({
  unlocked,
  unlockLoading,
  analysisLoading,
  onUnlock,
  children,
  scanProgress,
  walletRefreshing,
  walletAddress,
}: {
  unlocked: boolean;
  unlockLoading?: boolean;
  /** First score pass after paid unlock — not the long background refine. */
  analysisLoading?: boolean;
  onUnlock: () => void;
  children: React.ReactNode;
  scanProgress?: string;
  walletRefreshing?: boolean;
  walletAddress?: string;
}) {
  const product = getX402Product("analytics");
  const showPaidScan = unlocked && Boolean(analysisLoading);

  return (
    <div className={`relative w-full ${!unlocked || showPaidScan ? "min-h-[36rem]" : ""}`}>
      <div
        className={`w-full transition-[filter,opacity] duration-500 ${
          !unlocked
            ? "blur-[8px] opacity-65 pointer-events-none select-none"
            : showPaidScan
              ? "blur-[6px] opacity-75 pointer-events-none select-none"
              : ""
        }`}
        aria-hidden={!unlocked || showPaidScan}
      >
        {unlocked ? children : <LockedAnalyticsSilhouette />}
      </div>

      {/* PRE-PAY — blue lock / no “scanning” chrome (different from post-pay). */}
      {!unlocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-sky-950/10 p-4 min-h-[36rem]">
          <div className="max-w-sm w-full bg-white border border-sky-200 rounded-2xl p-6 text-center shadow-[0_18px_50px_rgba(37,99,235,0.14)]">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center mx-auto mb-4">
              <Lock size={22} className="text-sky-700" />
            </div>
            <p className="text-[10px] font-black text-sky-700 uppercase tracking-widest">
              Locked · x402 on Base
            </p>
            <h4 className="text-lg font-black text-slate-900 mt-2">
              Unlock Onchain Analytics
            </h4>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Nothing is indexed yet. Pay once so we collect{" "}
              <strong className="text-slate-800">only this wallet&apos;s</strong> history
              (Alchemy + AA UserOps) and build score, heatmap, and AA stats.
            </p>
            <p className="text-2xl font-black text-sky-900 mt-4 tabular-nums">
              {product.priceDisplay} USDC
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              One-time unlock · no scan until payment confirms
            </p>
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
                  Pay {product.amountLabel} to start scan
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
              After payment the card turns green and live-indexes your address only.
            </p>
          </div>
        </div>
      )}

      {/* POST-PAY — emerald scanning overlay (visually distinct from lock card). */}
      {showPaidScan && (
        <AnalyticsLoadingPanel
          variant="overlay"
          scanProgress={scanProgress}
          walletRefreshing={walletRefreshing || unlockLoading}
          walletAddress={walletAddress}
        />
      )}
    </div>
  );
}
