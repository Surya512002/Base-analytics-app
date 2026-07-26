"use client";

import { Globe, Twitter } from "lucide-react";

export interface LaunchPreviewData {
  name: string;
  symbol: string;
  description: string;
  imagePreview: string | null;
  website: string;
  twitter: string;
  supplyCap: string;
  walletPct: number;
  mintAmount: string;
  predictedAddress: string | null;
  poolPct?: number;
  vestedPct?: number;
  quoteToken?: string;
}

function shortAddr(addr: string | null): string {
  if (!addr) return "0xB200…";
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

export default function TokenLaunchPreview({ data }: { data: LaunchPreviewData }) {
  const displayName = data.name.trim() || "Token Name";
  const displaySymbol = data.symbol.trim().toUpperCase() || "TOKEN";

  return (
    <div className="sticky top-4 space-y-4">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-raised)] overflow-hidden">
        <div className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-3">
            Live preview
          </p>

          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl border border-white/10 bg-white/[0.06] overflow-hidden shrink-0 flex items-center justify-center">
              {data.imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.imagePreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-[var(--ink)]">
                  {displaySymbol.slice(0, 2)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-white text-xl truncate">{displayName}</h3>
              <p className="text-[var(--ink-muted)] font-bold">${displaySymbol}</p>
              <p className="text-[10px] text-slate-500 mt-1">Quote: {data.quoteToken ?? "ETH"}</p>
              {data.description.trim() ? (
                <p className="text-xs text-slate-400 mt-2 line-clamp-3">{data.description}</p>
              ) : (
                <p className="text-xs text-slate-600 mt-2 italic">What is this token about?</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            {data.website.trim() && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                <Globe size={10} /> Website
              </span>
            )}
            {data.twitter.trim() && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                <Twitter size={10} /> X
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2 text-[11px]">
        <p className="text-[10px] font-bold text-slate-500 uppercase">Launch summary</p>
        <div className="flex justify-between text-slate-400">
          <span>Fixed supply</span>
          <span className="text-white font-mono">{data.supplyCap}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Creator wallet</span>
          <span className="text-[var(--ink-muted)] font-mono">
            {data.walletPct}% · {data.mintAmount}
          </span>
        </div>
        {data.poolPct !== undefined && (
          <div className="flex justify-between text-slate-400">
            <span>Pool seed reserve</span>
            <span className="text-emerald-300/90 font-mono">{data.poolPct}%</span>
          </div>
        )}
        {(data.vestedPct ?? 0) > 0 && (
          <div className="flex justify-between text-slate-400">
            <span>Vested (unminted)</span>
            <span className="text-[var(--ink-muted)] font-mono">{data.vestedPct}%</span>
          </div>
        )}
        <div className="flex justify-between text-slate-400">
          <span>Vanity address</span>
          <span className="text-white font-mono">{shortAddr(data.predictedAddress)}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Admin</span>
          <span className="text-emerald-400">Renounced</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Standard</span>
          <span className="text-emerald-400">B20 · Base</span>
        </div>
      </div>
    </div>
  );
}
