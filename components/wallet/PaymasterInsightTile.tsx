"use client";

import { Smartphone, Zap } from "lucide-react";
import type { WalletData } from "@/lib/types/wallet";

export default function PaymasterInsightTile({ wallet }: { wallet: WalletData }) {
  const count = wallet.paymasterTxCount;
  const pct = wallet.txCount > 0 ? Math.round((count / wallet.txCount) * 100) : 0;

  return (
    <div className="elegant-panel rounded-2xl border border-[var(--border-subtle)] p-4 flex items-start gap-3">
      <div className="w-11 h-11 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
        <Smartphone size={20} className="text-[var(--ink-muted)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-black text-white text-sm">Smart wallet activity</p>
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--ink-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
            Base App · Paymaster
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {count > 0
            ? `${count} sponsored / user-op transactions (${pct}% of activity)`
            : "No paymaster activity detected — connect via Base App for gasless txs."}
        </p>
        {count > 0 && (
          <p className="text-[10px] text-emerald-400 font-bold mt-2 flex items-center gap-1">
            <Zap size={10} /> Included in your activity heatmap
          </p>
        )}
      </div>
    </div>
  );
}
