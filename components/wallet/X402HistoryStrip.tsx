"use client";

import { Zap } from "lucide-react";
import { basescanTxUrl } from "@/lib/utils/tx";
import { X402_PRODUCTS } from "@/lib/constants/x402-products";

interface X402HistoryStripProps {
  payCount: number;
  lastTx?: string;
  unlocked: boolean;
  onPay: () => void;
  loading?: boolean;
}

export default function X402HistoryStrip({
  payCount,
  lastTx,
  unlocked,
  onPay,
  loading,
}: X402HistoryStripProps) {
  const txUrl = lastTx ? basescanTxUrl(lastTx) : null;

  return (
    <div className="glass-panel-accent rounded-2xl p-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
            <Zap size={18} className="text-[var(--brand-dark)]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-black text-[var(--ink)] text-sm">x402 Payments</p>
              <span className="text-[9px] font-semibold text-[var(--ink-muted)] bg-[var(--surface-2)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full">
                HTTP 402 · Base
              </span>
              {unlocked && (
                <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                  Unlocked
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              {payCount > 0
                ? `${payCount} onchain payment${payCount > 1 ? "s" : ""} settled via x402`
                : "Pay-per-use micropayments — no account required"}
            </p>
            {txUrl && (
              <a
                href={txUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-semibold text-[var(--brand-dark)] hover:underline mt-1 inline-block"
              >
                Latest settlement on Basescan ↗
              </a>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onPay}
          disabled={loading}
          className="btn-primary text-xs px-5 py-3 rounded-2xl shrink-0 disabled:opacity-50"
        >
          {loading ? "Signing…" : payCount > 0 ? `Pay again · ${X402_PRODUCTS[0].amountLabel}` : `Try x402 · from ${X402_PRODUCTS[0].priceDisplay}`}
        </button>
      </div>
    </div>
  );
}
