"use client";

import { CheckCircle, RefreshCcw, Zap } from "lucide-react";
import Link from "next/link";
import { basescanTxUrl } from "@/lib/utils/tx";
import { X402_PRODUCTS, type X402ProductId } from "@/lib/constants/x402-products";

interface PremiumBannerProps {
  premiumLoading: boolean;
  premiumData: { message: string; transaction?: string } | null;
  x402PayCount: number;
  product: X402ProductId;
  onProductChange: (id: X402ProductId) => void;
  onPay: (product: X402ProductId) => void;
}

export default function PremiumBanner({
  premiumLoading,
  premiumData,
  x402PayCount,
  product,
  onProductChange,
  onPay,
}: PremiumBannerProps) {
  const selected = X402_PRODUCTS.find((p) => p.id === product) ?? X402_PRODUCTS[0];

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] overflow-hidden shadow-[0_0_32px_rgba(251,191,36,0.06)]">
      <div className="h-0.5 bg-linear-to-r from-amber-400/70 via-champagne/50 to-violet-500/50" />
      <div className="p-4 sm:p-[1.15rem] flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3.5">
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center shrink-0">
              <Zap size={17} className="text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-black text-white">x402 Premium</p>
                <span className="text-[10px] font-black text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                  HTTP 402
                </span>
                {x402PayCount > 0 && (
                  <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle size={10} /> {x402PayCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">{selected.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {X402_PRODUCTS.map((p) => {
              const active = product === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onProductChange(p.id)}
                  title={p.description}
                  className={`rounded-xl px-3 py-2 border text-left transition-all ${
                    active
                      ? "border-amber-400/50 bg-amber-500/15 shadow-[0_0_16px_rgba(251,191,36,0.1)]"
                      : "border-white/8 bg-white/[0.03] hover:border-amber-400/25"
                  }`}
                >
                  <span className="text-[11px] font-bold text-slate-400 block leading-none">{p.label}</span>
                  <span
                    className={`text-base font-black tabular-nums leading-tight ${
                      active ? "text-amber-300" : "text-white"
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
                <Zap size={14} /> Pay {selected.amountLabel}
              </>
            )}
          </button>
        </div>

        {premiumData?.transaction && (() => {
          const url = basescanTxUrl(premiumData.transaction);
          return url ? (
            <div className="flex flex-wrap gap-3 pl-[2.85rem] sm:pl-0">
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline">
                Basescan ↗
              </a>
              <Link href={`/receipt/${premiumData.transaction}`} className="text-xs text-violet-400 hover:underline">
                Receipt →
              </Link>
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}
