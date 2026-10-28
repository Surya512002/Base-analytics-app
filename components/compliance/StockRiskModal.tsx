"use client";

import { useState } from "react";
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay)] backdrop-blur-md animate-meridian-fade">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-3)] p-6 shadow-2xl space-y-5 animate-meridian-scale text-[var(--ink)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="font-display font-black text-lg tracking-tight text-[var(--ink)]">
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
            className="p-1.5 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition cursor-pointer"
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Risk Points */}
        <div className="space-y-3 text-xs text-[var(--ink-muted)] leading-relaxed">
          <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-start gap-2">
              <span className="font-bold text-[var(--ink)] shrink-0">1. Equity Volatility &amp; Loss:</span>
              <span>
                Tokenized stock prices reflect underlying equity movements and can be volatile. You may lose some or all deposited funds.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-[var(--ink)] shrink-0">2. Market Hours vs. AMM:</span>
              <span>
                US equity exchanges trade 24/5; AMM liquidity pools operate 24/7 on Base. Off-market trades rely on live pool liquidity and oracle feeds may freeze or reflect wider spreads outside market hours.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-[var(--ink)] shrink-0">3. Issuer &amp; Geographic Terms:</span>
              <span>
                Tokenized stocks are backed and minted under the issuer&apos;s regulatory terms. Product access is subject to jurisdiction and may be restricted in your region.
              </span>
            </div>
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
        <div className="pt-2">
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
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-[var(--border-subtle)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--ink)] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!confirmed}
            onClick={onAcknowledge}
            className="flex-1 btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShieldCheck size={14} />
            <span>Acknowledge &amp; Continue</span>
          </button>
        </div>
      </div>
    </div>
  );
}
