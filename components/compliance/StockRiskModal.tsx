"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ExternalLink, ShieldCheck, X } from "lucide-react";
import Link from "next/link";

interface StockRiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcknowledge: () => void;
  issuerTermsUrl?: string;
}

export default function StockRiskModal({
  isOpen,
  onClose,
  onAcknowledge,
  issuerTermsUrl = "https://www.coinbase.com/legal/tokenized-stocks",
}: StockRiskModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-[var(--overlay)] backdrop-blur-md animate-meridian-fade">
      {/* Never taller than the screen: the notice scrolls, the tick box and buttons stay in view. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-risk-title"
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col gap-3 rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-3)] p-4 sm:gap-5 sm:p-6 shadow-2xl animate-meridian-scale text-[var(--ink)]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3 sm:pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 id="stock-risk-title" className="font-display font-black text-base sm:text-lg tracking-tight text-[var(--ink)]">
                Tokenized Stocks Risk Notice
              </h3>
              <p className="text-xs text-[var(--ink-muted)]">
                Product Safeguards · Review Before Interacting
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition cursor-pointer"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Risk Points */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain text-xs text-[var(--ink-muted)] leading-relaxed">
          <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-2">
            <p>
              <span className="font-bold text-[var(--ink)]">1. Equity Volatility &amp; Loss:</span>{" "}
              Tokenized stock prices reflect underlying equity movements and can be volatile. You may lose some or all deposited funds.
            </p>
            <p>
              <span className="font-bold text-[var(--ink)]">2. Market Hours vs. AMM:</span>{" "}
              US equity exchanges trade 24/5; AMM liquidity pools operate 24/7 on Base. Off-market trades rely on live pool liquidity and oracle feeds may freeze or reflect wider spreads outside market hours.
            </p>
            <p>
              <span className="font-bold text-[var(--ink)]">3. Issuer &amp; Geographic Terms:</span>{" "}
              Tokenized stocks are backed and minted under the issuer&apos;s regulatory terms. Product access is subject to jurisdiction and may be restricted in your region.
            </p>
          </div>

          {/* Links Row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[11px]">
            <a
              href={issuerTermsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>Issuer Terms of Service</span>
              <ExternalLink size={10} />
            </a>
            <Link
              href="/risk-disclosure"
              target="_blank"
              className="inline-flex items-center gap-1 font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:underline"
            >
              <span>Risk Disclosure</span>
            </Link>
            <Link
              href="/terms"
              target="_blank"
              className="inline-flex items-center gap-1 font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:underline"
            >
              <span>Terms</span>
            </Link>
            <Link
              href="/privacy"
              target="_blank"
              className="inline-flex items-center gap-1 font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:underline"
            >
              <span>Privacy</span>
            </Link>
          </div>
        </div>

        {/* Checkbox Acknowledgment */}
        <div className="shrink-0">
          <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-2)] transition cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[var(--border-subtle)] text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs text-[var(--ink)] leading-snug">
              I confirm that I am not located in, or a resident of, any restricted jurisdiction (including the United States or sanctioned regions), and I have read and understand the risks, issuer terms, and platform disclosures.
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 py-2.5 rounded-xl text-xs font-bold border border-[var(--border-subtle)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--ink)] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!confirmed}
            onClick={onAcknowledge}
            className="min-h-11 flex-1 btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShieldCheck size={14} />
            <span>Acknowledge &amp; Continue</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
