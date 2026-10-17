"use client";

import { useState } from "react";
import VoucherGiftCard3D from "@/components/wallet/VoucherGiftCard3D";
import AppLogo from "@/components/ui/AppLogo";
import { Gift, Sparkles, TrendingUp, Zap } from "lucide-react";
import type { VoucherAsset } from "@/lib/utils/voucher";

const STATS = [
  { icon: <TrendingUp size={13} />, label: "Stocks (NVDA, AAPL, TSLA)" },
  { icon: <Gift size={13} />, label: "USDC & ETH" },
  { icon: <Zap size={13} />, label: "Gas sponsored" },
  { icon: <Sparkles size={13} />, label: "Up to 50 cards" },
] as const;

export default function VoucherHero() {
  const [heroAsset, setHeroAsset] = useState<VoucherAsset>("NVDAc");

  return (
    <div className="spotlight-card voucher-hero-glow relative overflow-hidden">
      <div className="accent-bar" />

      <div className="relative grid lg:grid-cols-2 gap-8 lg:gap-10 p-6 sm:p-8 items-center">
        <div className="text-center lg:text-left tab-content-enter">
          <p className="section-eyebrow flex items-center justify-center lg:justify-start gap-2 mb-4">
            <span className="live-dot" />
            Base Voucher Protocol · Stocks &amp; Crypto
          </p>

          <h2 className="page-hero-title leading-tight">Gift stocks &amp; crypto on Base</h2>
          <p className="readable-body text-base sm:text-lg mt-3 max-w-md mx-auto lg:mx-0">
            Deposit Coinbase B20 tokenized stocks (<strong className="text-[var(--ink)]">NVDA, AAPL, TSLA, COIN</strong>) or USDC/ETH and send them as verifiable onchain gift cards.
          </p>

          <div className="mt-6 flex flex-wrap gap-2 justify-center lg:justify-start">
            {STATS.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1.5 editorial-badge text-[10px] font-bold"
              >
                <span className="text-[var(--brand)]">{s.icon}</span>
                {s.label}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 justify-center lg:justify-start">
            <div className="inline-flex items-center gap-2.5 editorial-badge px-4 py-2.5">
              <AppLogo size="sm" />
              <span className="text-[10px] font-bold text-[var(--brand-dark)] uppercase tracking-widest">
                Built on Base
              </span>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setHeroAsset("NVDAc")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  heroAsset === "NVDAc"
                    ? "bg-[var(--brand)] text-white shadow-xs"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                NVDAc Stock
              </button>
              <button
                type="button"
                onClick={() => setHeroAsset("AAPLc")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  heroAsset === "AAPLc"
                    ? "bg-[var(--brand)] text-white shadow-xs"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                AAPLc Stock
              </button>
              <button
                type="button"
                onClick={() => setHeroAsset("USDC")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  heroAsset === "USDC"
                    ? "bg-[var(--brand)] text-white shadow-xs"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                USDC
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end py-4 lg:py-0 card-tilt-3d">
          <div className="animate-float">
            <VoucherGiftCard3D
              asset={heroAsset}
              amount={
                heroAsset === "NVDAc" || heroAsset === "AAPLc"
                  ? BigInt(100000000) // 1.0 share (8 decimals)
                  : BigInt(10000000) // $10 USDC (6 decimals)
              }
              message="A special onchain gift for you! 🎁"
              showStack
              animated
            />
          </div>
        </div>
      </div>
    </div>
  );
}

