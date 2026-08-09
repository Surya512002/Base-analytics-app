"use client";

import { Smartphone, Sparkles, Zap } from "lucide-react";
import type { WalletData } from "@/lib/types/wallet";

/**
 * AA / Base App activity — mirrors Basescan “Other Transactions → AA”.
 */
export default function PaymasterInsightTile({ wallet }: { wallet: WalletData }) {
  const aaCount = Math.max(wallet.aaTxCount ?? 0, 0);
  const gaslessCount = Math.max(wallet.paymasterTxCount ?? 0, aaCount);
  const sponsoredShare =
    aaCount > 0
      ? Math.min(100, Math.round((gaslessCount / Math.max(aaCount, 1)) * 100))
      : wallet.txCount > 0
        ? Math.round((gaslessCount / wallet.txCount) * 100)
        : 0;
  const ofTotal =
    wallet.txCount > 0
      ? Math.min(100, Math.round((aaCount / wallet.txCount) * 100))
      : 0;

  return (
    <div className="elegant-panel rounded-2xl border border-[var(--border-subtle)] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
          <Smartphone size={20} className="text-[var(--ink-muted)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-black text-[var(--ink)] text-sm">
              AA & Base App transactions
            </p>
            <span className="text-[8px] font-black uppercase tracking-widest text-[var(--ink-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
              ERC-4337 · EntryPoint
            </span>
          </div>
          <p className="text-xs text-[var(--ink-muted)] mt-1 leading-relaxed">
            Same class of activity as Basescan&apos;s{" "}
            <span className="text-[var(--ink)] font-semibold">
              Other Transactions → AA
            </span>
            . Counted from your wallet as UserOp sender (including Base App
            smart-wallet bundles).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-4">
        <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3">
          <p className="font-black text-2xl sm:text-3xl text-[var(--ink)] tabular-nums leading-none">
            {aaCount.toLocaleString()}
          </p>
          <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold tracking-wide mt-1.5">
            AA transactions
          </p>
          <p className="text-[10px] text-[var(--ink-dim)] mt-0.5">
            {aaCount > 0
              ? `${ofTotal}% of indexed activity`
              : "No UserOps found yet"}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3">
          <p className="font-black text-2xl sm:text-3xl text-[var(--ink)] tabular-nums leading-none">
            {gaslessCount.toLocaleString()}
          </p>
          <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold tracking-wide mt-1.5">
            Base App / gasless
          </p>
          <p className="text-[10px] text-[var(--ink-dim)] mt-0.5">
            {gaslessCount > 0
              ? "Paymaster · sponsored · smart wallet"
              : "No paymaster activity yet"}
          </p>
        </div>
      </div>

      {aaCount > 0 && (
        <p className="text-[10px] text-emerald-700 font-bold mt-3 flex items-center gap-1">
          <Zap size={10} />
          Included in score, heatmap, and recent activity labels
          {sponsoredShare > 0 ? ` · ~${sponsoredShare}% gas-related signal` : ""}
        </p>
      )}
      {aaCount === 0 && (
        <p className="text-[10px] text-[var(--ink-dim)] mt-3 flex items-center gap-1">
          <Sparkles size={10} />
          Open wallets in Base App often build AA history on check-in, GM, and
          gasless actions — re-sync after unlocking analytics.
        </p>
      )}
    </div>
  );
}
