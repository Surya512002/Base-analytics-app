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
    <div className="glass-panel-accent rounded-2xl border border-amber-500/20 p-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Zap size={18} className="text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-black text-white text-sm">x402 Payments</p>
              <span className="text-[9px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                HTTP 402 · Base
              </span>
              {unlocked && (
                <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Unlocked
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {payCount > 0
                ? `${payCount} onchain payment${payCount > 1 ? "s" : ""} settled via x402`
                : "Pay-per-use micropayments — no account required"}
            </p>
            {txUrl && (
              <a
                href={txUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-cyan-400 hover:text-cyan-300 underline mt-1 inline-block"
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
