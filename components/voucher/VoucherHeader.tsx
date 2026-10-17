"use client";

import { ExternalLink, Gift, ShieldCheck, Sparkles } from "lucide-react";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";

export default function VoucherHeader() {
  const contractAddress = VOUCHER_CONTRACT;
  const basescanUrl = contractAddress
    ? `https://basescan.org/address/${contractAddress}`
    : "https://basescan.org";

  return (
    <header className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        {/* Left: Title & One-line Description */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center shrink-0 border border-[#0052FF]/20">
              <Gift size={18} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--ink)] tracking-tight">
              Gift on Base
            </h1>
          </div>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed max-w-xl">
            Split tokenized stocks, yield vaults, USDC, or ETH into shareable onchain gift cards.
          </p>
        </div>

        {/* Right: 3 Compact Stats */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="pop flex flex-col px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
              Cards Created
            </span>
            <span className="text-base font-black text-[var(--ink)] tabular-nums mt-0.5">
              1,420+
            </span>
          </div>

          <div className="pop flex flex-col px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
              Total Gifted
            </span>
            <span className="text-base font-black text-[#0052FF] dark:text-[#388bfd] tabular-nums mt-0.5">
              $18.5K+
            </span>
          </div>

          <a
            href={basescanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pop-pill flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--ink)] hover:text-[#0052FF] hover:border-[#0052FF]/40 transition group cursor-pointer"
            title="View verified BaseVoucher contract on Basescan"
          >
            <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
            <span>Verified Contract</span>
            <ExternalLink size={12} className="text-[var(--ink-muted)] group-hover:text-[#0052FF] transition shrink-0" />
          </a>
        </div>
      </div>
    </header>
  );
}
