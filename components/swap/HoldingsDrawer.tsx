"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Wallet, Eye, EyeOff, ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import { CounterAvatar, type SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import { formatUsd } from "@/lib/launchpad/format";
import type { TokenHolding } from "@/hooks/useWalletHoldings";

function formatBalance(bal: number): string {
  if (bal >= 1_000_000) return `${(bal / 1_000_000).toFixed(2)}M`;
  if (bal >= 1_000) return `${(bal / 1_000).toFixed(2)}K`;
  if (bal >= 1) return bal.toFixed(3);
  if (bal >= 0.0001) return bal.toFixed(4);
  return bal.toFixed(6);
}

interface HoldingsDrawerProps {
  open: boolean;
  onClose: () => void;
  holdings: TokenHolding[];
  allHoldings: TokenHolding[];
  totalUsd: number;
  loading: boolean;
  dustCount: number;
  showDust: boolean;
  onToggleDust: () => void;
  onSelectToken: (counter: SwapCounter) => void;
  onRefresh: () => void;
}

export default function HoldingsDrawer({
  open,
  onClose,
  holdings,
  allHoldings,
  totalUsd,
  loading,
  dustCount,
  showDust,
  onToggleDust,
  onSelectToken,
  onRefresh,
}: HoldingsDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Wallet Tokens">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="relative z-10 w-full sm:max-w-md h-full flex flex-col bg-[var(--surface)] border-l border-[var(--border-subtle)] shadow-[var(--shadow-card)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center">
                  <Wallet size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--ink)]">Your Tokens</h2>
                  <p className="text-xs text-[var(--ink-muted)] font-mono">
                    Total: <strong className="text-[var(--ink)]">{formatUsd(totalUsd)}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  aria-label="Refresh holdings"
                  className="p-2 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer disabled:opacity-50"
                  title="Refresh holdings"
                >
                  <RefreshCw size={15} className={loading ? "animate-spin text-[var(--brand)]" : ""} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close drawer"
                  className="p-2 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Dust Filter Bar */}
            {dustCount > 0 && (
              <div className="px-5 py-2.5 bg-[var(--surface-2)] border-b border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-xs text-[var(--ink-muted)]">
                  {dustCount} small balance{dustCount === 1 ? "" : "s"} (&lt; $0.01)
                </span>
                <button
                  type="button"
                  onClick={onToggleDust}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand)] hover:underline cursor-pointer"
                >
                  {showDust ? (
                    <>
                      <EyeOff size={13} />
                      <span>Hide small</span>
                    </>
                  ) : (
                    <>
                      <Eye size={13} />
                      <span>Show small</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {loading && allHoldings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-xs text-[var(--ink-muted)]">
                  <Loader2 size={24} className="animate-spin text-[var(--brand)]" />
                  <span>Scanning Base balances…</span>
                </div>
              ) : holdings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-center p-6">
                  <p className="text-sm font-semibold text-[var(--ink)]">No token balances found</p>
                  <p className="text-xs text-[var(--ink-muted)]">
                    Deposit or swap tokens on Base to start trading.
                  </p>
                </div>
              ) : (
                holdings.map((h) => (
                  <button
                    key={h.symbol + (h.address ?? "eth")}
                    type="button"
                    onClick={() => {
                      onSelectToken(h.counter);
                      onClose();
                    }}
                    className="pop-row w-full flex items-center justify-between p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] transition-all cursor-pointer group text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CounterAvatar counter={h.counter} size={34} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm text-[var(--ink)] truncate group-hover:text-[var(--brand)] transition-colors">
                            {h.symbol}
                          </p>
                          <span className="text-[10px] text-[var(--ink-dim)] truncate">
                            {h.name}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-[var(--ink-muted)] tabular-nums">
                          {formatBalance(h.balance)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <p className="text-sm font-black text-[var(--ink)] font-mono tabular-nums">
                          {formatUsd(h.usdValue)}
                        </p>
                        <p className="text-[10px] text-[var(--ink-dim)] font-medium">Click to sell</p>
                      </div>
                      <ArrowRight size={14} className="text-[var(--ink-dim)] group-hover:text-[var(--brand)] group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100" />
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-[var(--surface-2)] border-t border-[var(--border-subtle)] text-center text-xs text-[var(--ink-dim)]">
              Click any token to set it as your Sell asset
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
