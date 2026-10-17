"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, Coins, Lock, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function WhatYouGetSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-[var(--surface-2)]/60 transition cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg bg-[#0052FF]/10 text-[#0052FF]">
            <ShieldCheck size={18} />
          </span>
          <div>
            <h3 className="text-sm font-black text-[var(--ink)]">What you get when launching on Base</h3>
            <p className="text-xs text-[var(--ink-muted)]">Verified contracts, perpetual creator royalties &amp; safety features</p>
          </div>
        </div>
        <span className="p-1 rounded-lg text-[var(--ink-muted)]">
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      {isOpen && (
        <div className="p-4 sm:p-5 pt-0 border-t border-[var(--border-subtle)]/60 grid sm:grid-cols-2 gap-4 text-xs">
          <div className="pop p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--ink)] font-bold">
              <Coins size={15} className="text-[#0052FF]" />
              <span>0.25% Creator Fee Share</span>
            </div>
            <p className="text-[var(--ink-muted)] leading-relaxed">
              Every token swap on Aerodrome and Uniswap V3 includes a 0.5% platform fee split 50/50. You receive 0.25% instantly on each trade directly to your creator wallet.
            </p>
          </div>

          <div className="pop p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--ink)] font-bold">
              <Zap size={15} className="text-amber-500" />
              <span>B20 Precompiles &amp; Vanity Salts</span>
            </div>
            <p className="text-[var(--ink-muted)] leading-relaxed">
              Tokens use gas-optimized Base precompile standards. Vanity salt grinding gives your token a recognizable 0xB20… contract prefix on BaseScan at zero extra cost.
            </p>
          </div>

          <div className="pop p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--ink)] font-bold">
              <Lock size={15} className="text-emerald-500" />
              <span>OpenLaunch Liquidity Locker</span>
            </div>
            <p className="text-[var(--ink-muted)] leading-relaxed">
              Initial liquidity seeded through the launchpad is provably locked in the OpenLaunch smart contract for 30 to 365 days, giving traders rug-pull resistance.
            </p>
          </div>

          <div className="pop p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--ink)] font-bold">
              <ShieldCheck size={15} className="text-blue-500" />
              <span>Anti-Snipe Block Window</span>
            </div>
            <p className="text-[var(--ink-muted)] leading-relaxed">
              Configurable block window (0–24 blocks) prevents MEV bots and front-runners from draining the initial liquidity pool upon deployment.
            </p>
          </div>

          <div className="sm:col-span-2 pt-2 flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
            <span>Learn more about creator profiles &amp; vesting schedules</span>
            <Link href="/profile" className="text-[#0052FF] font-bold inline-flex items-center gap-1 hover:underline">
              Creator Profile <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
