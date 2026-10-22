"use client";

import React from "react";
import { Zap, Coins, DollarSign, RefreshCw } from "lucide-react";

export default function LaunchHeader() {
  return (
    <div className="space-y-4">
      {/* Title & Subtitle */}
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)] text-xs font-bold mb-2">
          <Zap size={13} />
          <span>Base Mainnet Token Factory</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[var(--ink)] tracking-tight">
          Launch on Base
        </h1>
        <p className="text-sm text-[var(--ink-muted)] mt-1.5 max-w-2xl">
          Deploy verified B20 vanity tokens, standard meme coins, or Stonks-style stock-paired tokens with built-in creator revenue sharing.
        </p>
      </div>

      {/* 3 Compact Facts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign size={16} />
          </div>
          <div>
            <p className="text-xs font-black text-[var(--ink)]">$0 Launch Fee</p>
            <p className="text-[11px] text-[var(--ink-muted)]">No platform creation charge</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]">
          <div className="w-8 h-8 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center shrink-0">
            <Coins size={16} />
          </div>
          <div>
            <p className="text-xs font-black text-[var(--ink)]">0.25% Creator Revenue</p>
            <p className="text-[11px] text-[var(--ink-muted)]">Earned on every DEX swap</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <RefreshCw size={16} />
          </div>
          <div>
            <p className="text-xs font-black text-[var(--ink)]">Instant Payouts</p>
            <p className="text-[11px] text-[var(--ink-muted)]">Direct to creator wallet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
