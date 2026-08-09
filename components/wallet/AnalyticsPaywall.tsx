"use client";

import { Lock, RefreshCcw, Zap } from "lucide-react";
import { getX402Product } from "@/lib/constants/x402-products";
import AnalyticsLoadingPanel from "@/components/wallet/AnalyticsLoadingPanel";

export default function AnalyticsPaywall({
  unlocked,
  unlockLoading,
  analysisLoading,
  onUnlock,
  children,
  scanProgress,
  walletRefreshing,
}: {
  unlocked: boolean;
  unlockLoading?: boolean;
  /** Full history / score sync after paid unlock — blurs score & heatmap until ready. */
  analysisLoading?: boolean;
  onUnlock: () => void;
  children: React.ReactNode;
  scanProgress?: string;
  walletRefreshing?: boolean;
}) {
  const product = getX402Product("analytics");
  const obscure = !unlocked || Boolean(analysisLoading);

  return (
    <div className="relative w-full min-h-[28rem]">
      <div
        className={`w-full transition-[filter,opacity] duration-500 ${
          obscure ? "blur-[7px] opacity-80 pointer-events-none select-none scale-[0.995]" : ""
        }`}
        aria-hidden={obscure}
      >
        {children}
      </div>

      {!unlocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-[var(--surface)]/55 p-4 min-h-[28rem]">
          <div className="max-w-sm w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl p-6 text-center shadow-[0_18px_50px_rgba(11,21,38,0.16)]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-4">
              <Lock size={22} className="text-[var(--ink-muted)]" />
            </div>
            <p className="text-[10px] font-black text-[var(--ink-muted)] uppercase tracking-widest">
              x402 · Base mainnet
            </p>
            <h4 className="text-lg font-black text-[var(--ink)] mt-2">Unlock Onchain Analytics</h4>
            <p className="text-sm text-[var(--ink-muted)] mt-2 leading-relaxed">
              Pay once to collect your full onchain history via Alchemy — every check-in, swap,
              smart-wallet AA / paymaster tx, and activity day — then unlock score, heatmap, and
              wallet health.
            </p>
            <p className="text-2xl font-black text-[var(--ink)] mt-4 tabular-nums">
              {product.priceDisplay} USDC
            </p>
            <p className="text-[11px] text-[var(--ink-dim)] mt-1">
              via x402 on Base · persists until disconnect
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
                  Pay {product.amountLabel} to unlock
                </>
              )}
            </button>
            <p className="text-[10px] text-[var(--ink-dim)] mt-3 leading-relaxed">
              Disconnecting clears unlock — reconnect and pay again to view analytics.
            </p>
          </div>
        </div>
      )}

      {unlocked && analysisLoading && (
        <AnalyticsLoadingPanel
          variant="overlay"
          scanProgress={scanProgress}
          walletRefreshing={walletRefreshing || unlockLoading}
        />
      )}
    </div>
  );
}
