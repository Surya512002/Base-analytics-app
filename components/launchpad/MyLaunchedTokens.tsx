"use client";

import { Rocket } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { createdAgo, shortAddr } from "@/lib/launchpad/format";
import TokenMarketBadge from "@/components/launchpad/TokenMarketBadge";

export default function MyLaunchedTokens({
  tokens,
  wallet,
  onOpen,
}: {
  tokens: LaunchedToken[];
  wallet: string;
  onOpen: (token: LaunchedToken) => void;
}) {
  const mine = tokens
    .filter((t) => t.creator.toLowerCase() === wallet.toLowerCase())
    .slice(0, 6);

  if (mine.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-raised)] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Rocket size={16} className="text-[var(--ink-muted)]" />
        <p className="text-sm font-black text-[var(--ink)]">Your launched tokens</p>
        <span className="text-[10px] text-[var(--ink-dim)] ml-auto">{mine.length} live</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {mine.map((t) => (
          <button
            key={t.address}
            type="button"
            onClick={() => onOpen(t)}
            className="text-left rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] px-3 py-2.5 transition-colors"
          >
            <div className="flex items-center gap-2">
              {t.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-[10px] font-black text-[var(--ink-muted)]">
                  {t.symbol.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-[var(--ink)] truncate">{t.name}</p>
                <p className="text-[10px] text-[var(--ink-muted)] font-bold">${t.symbol}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px]">
              <span className="text-[var(--ink-dim)] font-mono">{shortAddr(t.address)}</span>
              <TokenMarketBadge address={t.address} />
            </div>
            <p className="text-[9px] text-slate-600 mt-1">{createdAgo(t.createdAt)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
