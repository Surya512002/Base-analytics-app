"use client";

import { CheckCircle, RefreshCcw, Zap } from "lucide-react";
import Link from "next/link";
import { basescanTxUrl } from "@/lib/utils/tx";
import { X402_PRODUCTS, type X402ProductId } from "@/lib/constants/x402-products";

interface PremiumBannerProps {
  premiumLoading: boolean;
  premiumUnlocked: boolean;
  premiumData: { message: string; transaction?: string } | null;
  x402PayCount: number;
  product: X402ProductId;
  onProductChange: (id: X402ProductId) => void;
  onPay: (product: X402ProductId) => void;
}

export default function PremiumBanner({
  premiumLoading,
  premiumUnlocked,
  premiumData,
  x402PayCount,
  product,
  onProductChange,
  onPay,
}: PremiumBannerProps) {
  const selected = X402_PRODUCTS.find((p) => p.id === product) ?? X402_PRODUCTS[0];

  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      <div className="accent-bar" />
      <div className="p-4 sm:p-[1.15rem] flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3.5">
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
              <Zap size={17} className="text-[var(--brand-dark)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-black text-[var(--ink)]">x402 Premium</p>
                <span className="text-[10px] font-semibold text-[var(--ink-muted)] bg-[var(--surface-2)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full">
                  HTTP 402
                </span>
                {x402PayCount > 0 && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle size={10} /> {x402PayCount} paid
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--ink-muted)]">{selected.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {X402_PRODUCTS.map((p) => {
              const active = product === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onProductChange(p.id)}
                  title={p.description}
                  className={`rounded-xl px-3 py-2 border text-left transition-all ${
                    active ? "preset-chip-active" : "preset-chip"
                  }`}
                >
                  <span
                    className={`text-[11px] font-bold block leading-none ${
                      active ? "text-[var(--brand-dark)]" : "text-[var(--ink-muted)]"
                    }`}
                  >
                    {p.label}
                  </span>
                  <span
                    className={`text-base font-black tabular-nums leading-tight ${
                      active ? "text-[var(--brand-dark)]" : "text-[var(--ink)]"
                    }`}
                  >
                    {p.priceDisplay}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPay(product)}
            disabled={premiumLoading}
            className="btn-primary disabled:opacity-50 text-sm px-5 py-3 rounded-xl flex items-center justify-center gap-2 font-black whitespace-nowrap shrink-0 w-full sm:w-auto"
          >
            {premiumLoading ? (
              <>
                <RefreshCcw size={14} className="animate-spin" /> Signing…
              </>
            ) : (
              <>
                <Zap size={14} />{" "}
                {premiumUnlocked ? "Pay again" : "Pay"} {selected.amountLabel}
              </>
            )}
          </button>
        </div>

        {premiumData?.transaction && (() => {
          const url = basescanTxUrl(premiumData.transaction);
          return url ? (
            <div className="flex flex-wrap gap-3 pl-[2.85rem] sm:pl-0">
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[var(--brand-dark)] hover:underline">
                Basescan ↗
              </a>
              <Link href={`/receipt/${premiumData.transaction}`} className="text-xs font-semibold text-[var(--brand-dark)] hover:underline">
                Receipt →
              </Link>
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}
