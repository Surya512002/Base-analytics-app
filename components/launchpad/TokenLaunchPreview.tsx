"use client";

import { Globe, Twitter } from "lucide-react";

import type { LaunchTokenType } from "@/lib/launchpad/types";
import TokenLogo from "@/components/ui/TokenLogo";

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
  tokenType?: LaunchTokenType;
  quoteStock?: string;
  liquidityLocked?: boolean;
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
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-dim)] mb-3">
            Live preview
          </p>

          <div className="flex items-start gap-4">
            <TokenLogo
              symbol={displaySymbol}
              src={data.imagePreview}
              size={64}
              shape="rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-black text-[var(--ink)] text-xl truncate">{displayName}</h3>
                {data.tokenType === "memestock" && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25">
                    Memestock
                  </span>
                )}
                {data.tokenType === "standard" && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                    ERC-20 Meme
                  </span>
                )}
                {(!data.tokenType || data.tokenType === "b20") && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                    B20 Vanity
                  </span>
                )}
              </div>
              <p className="text-[var(--brand-dark)] font-bold">${displaySymbol}</p>
              <p className="text-[11px] text-[var(--ink-muted)] mt-1">
                Pair: <span className="font-bold text-[var(--ink)]">{displaySymbol} / {data.quoteToken ?? "ETH"}</span>
              </p>
              {data.description.trim() ? (
                <p className="text-xs text-[var(--ink-muted)] mt-2 line-clamp-3 leading-relaxed">{data.description}</p>
              ) : (
                <p className="text-xs text-[var(--ink-dim)] mt-2 italic">What is this token about?</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            {data.website.trim() && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-muted)]">
                <Globe size={11} /> Website
              </span>
            )}
            {data.twitter.trim() && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-muted)]">
                <Twitter size={11} /> X
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-2 text-[11px]">
        <p className="text-[10px] font-bold text-[var(--ink-dim)] uppercase tracking-wider">Launch summary</p>
        <div className="flex justify-between text-[var(--ink-muted)]">
          <span>Supply</span>
          <span className="text-[var(--ink)] font-mono font-bold">{data.supplyCap}</span>
        </div>
        <div className="flex justify-between text-[var(--ink-muted)]">
          <span>Creator allocation</span>
          <span className="text-[var(--ink)] font-mono font-medium">
            {data.walletPct}% · {data.mintAmount}
          </span>
        </div>
        {data.poolPct !== undefined && (
          <div className="flex justify-between text-[var(--ink-muted)]">
            <span>Pool seed reserve</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{data.poolPct}%</span>
          </div>
        )}
        {(data.vestedPct ?? 0) > 0 && (
          <div className="flex justify-between text-[var(--ink-muted)]">
            <span>Vested (unminted)</span>
            <span className="text-[var(--ink)] font-mono">{data.vestedPct}%</span>
          </div>
        )}
        <div className="flex justify-between text-[var(--ink-muted)]">
          <span>Contract address</span>
          <span className="text-[var(--ink)] font-mono font-bold">{shortAddr(data.predictedAddress)}</span>
        </div>
        <div className="flex justify-between text-[var(--ink-muted)]">
          <span>Swap Fee Split</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">0.25% Creator / 0.25% Platform</span>
        </div>
        <div className="flex justify-between text-[var(--ink-muted)]">
          <span>Default Slippage</span>
          <span className="text-[var(--brand-dark)] font-mono font-bold">0.50%</span>
        </div>
        {data.liquidityLocked && (
          <div className="flex justify-between text-[var(--ink-muted)]">
            <span>Liquidity Lock</span>
            <span className="text-teal-600 dark:text-teal-400 font-semibold">OpenLaunch Locker</span>
          </div>
        )}
        <div className="flex justify-between text-[var(--ink-muted)]">
          <span>Standard</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {data.tokenType === "memestock" ? "Memestock (Stock Paired)" : data.tokenType === "standard" ? "ERC-20 (OpenLaunch)" : "B20 Precompile"}
          </span>
        </div>
      </div>
    </div>
  );
}
