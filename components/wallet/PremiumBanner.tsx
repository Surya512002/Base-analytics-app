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
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] overflow-hidden">
      <div className="h-px bg-linear-to-r from-amber-400/60 via-champagne/40 to-violet-500/40" />
      <div className="p-3 flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center shrink-0">
              <Zap size={14} className="text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs font-black text-white">x402 Premium</p>
                <span className="text-[8px] font-black text-violet-300 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-full">
                  HTTP 402
                </span>
                {x402PayCount > 0 && (
                  <span className="text-[8px] font-black text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <CheckCircle size={8} /> {x402PayCount}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 truncate">{selected.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            {X402_PRODUCTS.map((p) => {
              const active = product === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onProductChange(p.id)}
                  title={p.description}
                  className={`rounded-xl px-2.5 py-1.5 border text-left transition-all ${
                    active
                      ? "border-amber-400/50 bg-amber-500/15"
                      : "border-white/8 bg-white/[0.03] hover:border-amber-400/25"
                  }`}
                >
                  <span className="text-[9px] font-bold text-slate-400 block leading-none">{p.label}</span>
                  <span
                    className={`text-sm font-black tabular-nums leading-tight ${
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
            className="btn-primary disabled:opacity-50 text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-black whitespace-nowrap shrink-0 w-full sm:w-auto"
          >
            {premiumLoading ? (
              <>
                <RefreshCcw size={12} className="animate-spin" /> Signing…
              </>
            ) : (
              <>
                <Zap size={12} /> Pay {selected.amountLabel}
              </>
            )}
          </button>
        </div>

        {premiumData?.transaction && (() => {
          const url = basescanTxUrl(premiumData.transaction);
          return url ? (
            <div className="flex flex-wrap gap-2.5 pl-10 sm:pl-0">
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:underline">
                Basescan ↗
              </a>
              <Link href={`/receipt/${premiumData.transaction}`} className="text-[10px] text-violet-400 hover:underline">
                Receipt →
              </Link>
            </div>
          ) : null;
        })()}
      </div>
    </div>
  );
}
