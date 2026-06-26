"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Gift, Sparkles, X, Wallet } from "lucide-react";
import type { VoucherAsset } from "@/lib/utils/voucher";
import { formatVoucherAmount } from "@/lib/utils/voucher";
import { BaseNetworkBadge } from "@/components/wallet/VoucherGiftCard3D";
import { basescanTxUrl } from "@/lib/utils/tx";

export interface VoucherRedeemRevealData {
  cardId: string;
  asset: VoucherAsset;
  amountPerCard: bigint;
  message: string;
  txHash?: string;
}

interface VoucherRedeemRevealProps {
  data: VoucherRedeemRevealData | null;
  onClose: () => void;
}

const SPARKLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${8 + ((i * 17) % 84)}%`,
  delay: `${(i * 0.15) % 2.2}s`,
  duration: `${2.4 + (i % 4) * 0.35}s`,
  size: 4 + (i % 3) * 2,
}));

export default function VoucherRedeemReveal({ data, onClose }: VoucherRedeemRevealProps) {
  const [phase, setPhase] = useState<"enter" | "flip" | "reveal">("enter");

  useEffect(() => {
    if (!data) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const t1 = window.setTimeout(() => setPhase("flip"), 500);
    const t2 = window.setTimeout(() => setPhase("reveal"), 1400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [data]);

  if (typeof window === "undefined" || !data) return null;

  const amountLabel = formatVoucherAmount(data.asset, data.amountPerCard);
  const hasMessage = Boolean(data.message?.trim());
  const txUrl = data.txHash ? basescanTxUrl(data.txHash) : null;
  const isOpen = phase === "flip" || phase === "reveal";

  return createPortal(
    <div
      className="voucher-reveal-backdrop fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Voucher redeemed"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[#020812]/88 backdrop-blur-xl" />

      {SPARKLES.map((s) => (
        <span
          key={s.id}
          className="voucher-sparkle pointer-events-none absolute rounded-full bg-cyan-300"
          style={{
            left: s.left,
            bottom: "18%",
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}

      <div
        className={`relative w-full max-w-md voucher-reveal-pop ${phase !== "enter" ? "voucher-reveal-pop-done" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-2 -right-2 z-30 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="text-center mb-5">
          <p
            className={`text-[11px] font-black uppercase tracking-[0.35em] text-cyan-300 transition-all duration-700 ${
              phase === "reveal" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
            }`}
          >
            Gift unlocked
          </p>
          <h2
            className={`text-2xl sm:text-3xl font-black text-white mt-2 transition-all duration-700 delay-100 ${
              phase === "reveal" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            You got a <span className="text-gradient-blue">Base Voucher</span>
          </h2>
        </div>

        <div className="voucher-flip-stage mx-auto" style={{ perspective: "1400px" }}>
          <div className={`voucher-flip-card ${isOpen ? "voucher-flip-card-open" : ""}`}>
            <div className="voucher-flip-face voucher-flip-front">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(255,77,122,0.35),transparent_55%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_100%,rgba(0,82,255,0.28),transparent_50%)]" />
              <div className="relative h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-5 shadow-[0_0_40px_rgba(255,77,122,0.35)]">
                  <Gift size={32} className="text-rose-300" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">
                  Base Voucher
                </p>
                <p className="text-xl font-black text-white">A gift is waiting</p>
                <p className="text-sm text-slate-400 mt-2">Opening your card…</p>
                <div className="mt-6 flex items-center gap-2 text-cyan-300/80">
                  <Sparkles size={14} className="animate-pulse" />
                  <span className="text-xs font-bold">Onchain greeting card</span>
                  <Sparkles size={14} className="animate-pulse" />
                </div>
              </div>
            </div>

            <div className="voucher-flip-face voucher-flip-inside">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(16,185,129,0.25),transparent_55%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_80%,rgba(0,82,255,0.2),transparent_45%)]" />
              <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-emerald-400/50 to-transparent" />

              <div className="relative h-full flex flex-col p-6 sm:p-8">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400">From the sender</p>
                    <p className="text-xs font-black text-white/90">base-analytics</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <BaseNetworkBadge size="md" />
                    <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/15">
                      <Image src="/icon.png" alt="Base" width={32} height={32} className="object-cover" />
                    </div>
                  </div>
                </div>

                <div
                  className={`flex-1 flex flex-col justify-center transition-all duration-700 ${
                    phase === "reveal" ? "voucher-message-reveal" : "opacity-0 scale-95"
                  }`}
                >
                  {hasMessage ? (
                    <>
                      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-400/90 mb-3 text-center">
                        Personal message
                      </p>
                      <blockquote className="text-center px-1">
                        <p className="text-xl sm:text-2xl font-semibold text-white leading-snug italic font-serif">
                          &ldquo;{data.message.trim()}&rdquo;
                        </p>
                      </blockquote>
                    </>
                  ) : (
                    <p className="text-center text-lg font-bold text-slate-300 italic">
                      Enjoy your onchain gift!
                    </p>
                  )}
                </div>

                <div
                  className={`mt-5 pt-5 border-t border-white/10 transition-all duration-700 delay-200 ${
                    phase === "reveal" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">You received</p>
                      <p className="text-2xl font-black text-white mt-0.5">{amountLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-slate-500 uppercase">Card</p>
                      <p className="text-sm font-mono font-bold text-cyan-300 mt-0.5">{data.cardId}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`mt-6 space-y-3 transition-all duration-700 ${
            phase === "reveal" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
            <Wallet size={16} />
            <span>Funds sent to your wallet on Base</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {txUrl && (
              <a
                href={txUrl}
                target="_blank"
                rel="noreferrer"
                className="text-center text-sm font-black px-5 py-3 rounded-xl bg-white/10 border border-white/15 text-white hover:bg-white/15 transition"
              >
                View on BaseScan ↗
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-center text-sm font-black px-5 py-3 rounded-xl btn-primary text-white"
            >
              Awesome — thanks!
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
