"use client";

import React from "react";
import { ArrowDown, ShieldCheck, AlertTriangle, Fuel, Percent, CheckCircle2, X } from "lucide-react";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import { counterSymbol } from "@/components/launchpad/TokenPickerDialog";

interface SwapPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isConfirming?: boolean;
  from: SwapCounter;
  to: SwapCounter;
  payAmount: string;
  payUsd?: number | null;
  receiveAmount: string;
  receiveUsd?: number | null;
  priceImpactPct?: number | null;
  activeDexName?: string;
  isLaunchedToken?: boolean;
  slippagePct: string;
}

export default function SwapPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  isConfirming = false,
  from,
  to,
  payAmount,
  payUsd,
  receiveAmount,
  receiveUsd,
  priceImpactPct,
  activeDexName = "Aerodrome / Uniswap",
  isLaunchedToken = false,
  slippagePct,
}: SwapPreviewModalProps) {
  if (!isOpen) return null;

  const fromSym = counterSymbol(from);
  const toSym = counterSymbol(to);
  const isHighImpact = (priceImpactPct ?? 0) > 3;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay)] backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-3)] p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-[var(--ink)]">Review Swap</h3>
              <p className="text-xs text-[var(--ink-muted)]">Verified Base execution summary</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--ink-muted)] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* You Pay / You Receive Cards */}
        <div className="space-y-2">
          {/* Pay */}
          <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]">
            <div className="flex items-center justify-between text-xs text-[var(--ink-muted)] mb-1">
              <span className="font-bold">You Pay</span>
              {payUsd ? <span className="font-mono font-medium">${payUsd.toFixed(2)} USD</span> : null}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xl font-mono font-black text-[var(--ink)]">{payAmount}</span>
              <span className="font-bold text-sm text-[var(--ink)] bg-[var(--surface)] px-2.5 py-1 rounded-xl border border-[var(--border-subtle)]">
                {fromSym}
              </span>
            </div>
          </div>

          {/* Flip icon separator */}
          <div className="flex justify-center -my-1 relative z-10">
            <div className="w-7 h-7 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] shadow-xs flex items-center justify-center text-[var(--ink-muted)]">
              <ArrowDown size={14} />
            </div>
          </div>

          {/* Receive */}
          <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]">
            <div className="flex items-center justify-between text-xs text-[var(--ink-muted)] mb-1">
              <span className="font-bold">You Receive (Estimated)</span>
              {receiveUsd ? <span className="font-mono font-medium">${receiveUsd.toFixed(2)} USD</span> : null}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xl font-mono font-black text-emerald-600 dark:text-emerald-400">{receiveAmount}</span>
              <span className="font-bold text-sm text-[var(--ink)] bg-[var(--surface)] px-2.5 py-1 rounded-xl border border-[var(--border-subtle)]">
                {toSym}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Plain-English Breakdown */}
        <div className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 text-xs text-[var(--ink-muted)]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Percent size={13} className="text-[var(--brand)]" />
              <span>Slippage Tolerance</span>
            </span>
            <span className="font-mono font-bold text-[var(--ink)]">{slippagePct}%</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Fuel size={13} className="text-emerald-500" />
              <span>Estimated Base Gas</span>
            </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">~ $0.001 (Sub-cent)</span>
          </div>

          <div className="flex items-center justify-between">
            <span>DEX Routing Venue</span>
            <span className="font-mono font-bold text-[var(--ink)]">{activeDexName}</span>
          </div>

          <div className="flex items-center justify-between">
            <span>Platform Fee</span>
            <span className="font-mono font-bold text-[var(--ink)]">
              {isLaunchedToken ? "0.50% (50/50 Creator Split)" : "0.25% (Base Best)"}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
            <span>Price Impact</span>
            <span
              className={`font-mono font-bold ${
                isHighImpact ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {priceImpactPct != null ? `${priceImpactPct.toFixed(2)}%` : "< 0.05%"}
            </span>
          </div>
        </div>

        {/* Risk Warning (if high impact) */}
        {isHighImpact && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-amber-500" />
            <span>High price impact! You may receive substantially fewer tokens due to pool liquidity.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="py-3 rounded-xl font-bold text-xs bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border-subtle)] hover:bg-[var(--border-subtle)]/40 transition cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="py-3 rounded-xl font-bold text-xs bg-[#0052FF] text-white hover:bg-[#0047e0] active:scale-[0.98] transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 size={14} />
            <span>{isConfirming ? "Submitting…" : "Confirm & Sign"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
