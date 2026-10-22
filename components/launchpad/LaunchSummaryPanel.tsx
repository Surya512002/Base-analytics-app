"use client";

import React, { useState } from "react";
import {
  Globe,
  Twitter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { LaunchTokenType } from "@/lib/launchpad/types";
import { formatReadablePrice } from "@/lib/launchpad/launch-configs";
import TokenLogo from "@/components/ui/TokenLogo";

export interface LaunchSummaryPanelProps {
  name: string;
  symbol: string;
  description: string;
  imagePreview: string | null;
  website: string;
  twitter: string;
  telegram?: string;
  quoteSymbol: string;
  startPriceUsd: string;
  launchType: LaunchTokenType;
  creatorPct: number;
  poolReservePct: number;
  vestedTotalPct?: number;
  vanityAddress: string | null;
  vanityAttempts?: number;
  grinding: boolean;
  autoSeedLiquidity: boolean;
  seedLiquidityEth: string;
  seedDex?: string;
  liquidityLocked: boolean;
  lockDurationDays: number;
  ethUsd: number;
  onClearDraft?: () => void;
  desktopOnly?: boolean;
  mobileOnly?: boolean;
}

function shortAddr(addr: string | null): string {
  if (!addr) return "0xB200…";
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

export default function LaunchSummaryPanel({
  name,
  symbol,
  description,
  imagePreview,
  website,
  twitter,
  telegram: _telegram,
  quoteSymbol,
  startPriceUsd,
  launchType,
  creatorPct,
  poolReservePct,
  vestedTotalPct: _vestedTotalPct,
  vanityAddress,
  vanityAttempts: _vanityAttempts,
  grinding,
  autoSeedLiquidity,
  seedLiquidityEth,
  seedDex: _seedDex,
  liquidityLocked,
  lockDurationDays,
  ethUsd: _ethUsd,
  onClearDraft,
  desktopOnly = false,
  mobileOnly = false,
}: LaunchSummaryPanelProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const displayName = name.trim() || "Token Name";
  const displaySymbol = symbol.trim().toUpperCase() || "TOKEN";
  const readablePrice = formatReadablePrice(startPriceUsd);

  // Pricing calculations
  const priceNum = parseFloat(startPriceUsd) || 0;
  const supplyNum = 1_000_000_000;
  const impliedMcap = priceNum * supplyNum;
  const creatorTokens = Math.floor((supplyNum * creatorPct) / 100);
  const poolTokens = Math.floor((supplyNum * poolReservePct) / 100);

  // Gas & seed costs
  const seedEthNum = autoSeedLiquidity ? parseFloat(seedLiquidityEth) || 0 : 0;

  const content = (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* 1. Live Preview Card */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ink-muted)]">
            Live Preview
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              launchType === "memestock"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : launchType === "standard"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-[var(--brand-soft)] text-[var(--brand-text)]"
            }`}
          >
            {launchType === "memestock"
              ? "Stock-Paired"
              : launchType === "standard"
                ? "ERC-20 Meme"
                : "B20 Vanity"}
          </span>
        </div>

        <div className="flex items-start gap-3.5 min-w-0">
          <TokenLogo
            symbol={displaySymbol}
            src={imagePreview}
            size={52}
            shape="rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-sm text-[var(--ink)] truncate">{displayName}</h3>
            <p className="font-mono text-xs font-bold text-[var(--brand-text)] truncate">${displaySymbol}</p>
            <p className="text-[11px] text-[var(--ink-muted)] mt-0.5 truncate">
              Pair: <span className="font-mono font-bold text-[var(--ink)]">${displaySymbol} / {quoteSymbol}</span>
            </p>
          </div>
        </div>

        {description.trim() ? (
          <p className="text-xs text-[var(--ink-muted)] line-clamp-2 leading-relaxed pt-1 border-t border-[var(--border-subtle)]/40 break-words">
            {description}
          </p>
        ) : (
          <p className="text-[11px] text-[var(--ink-dim)] italic pt-1 border-t border-[var(--border-subtle)]/40">
            Add a description in Step 2…
          </p>
        )}

        {(website.trim() || twitter.trim()) && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--ink-muted)] pt-1">
            {website.trim() && (
              <span className="inline-flex items-center gap-1 truncate max-w-full">
                <Globe size={11} className="shrink-0" /> <span className="truncate">Website</span>
              </span>
            )}
            {twitter.trim() && (
              <span className="inline-flex items-center gap-1 truncate max-w-full">
                <Twitter size={11} className="shrink-0" /> <span className="truncate">X (Twitter)</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. Pricing & Implied Market Cap Card */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-sm space-y-2.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ink-muted)]">
          Pricing &amp; Valuation
        </span>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] min-w-0">
            <span className="text-[10px] text-[var(--ink-muted)] block truncate">Starting Price</span>
            <p className="text-xs font-mono font-bold text-[var(--ink)] truncate" title={`Exact: $${startPriceUsd}`}>
              {readablePrice}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] min-w-0">
            <span className="text-[10px] text-[var(--ink-muted)] block truncate">Implied Cap</span>
            <p className="text-xs font-mono font-bold text-[var(--ink)] truncate">
              ${impliedMcap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div className="text-xs text-[var(--ink-muted)] space-y-1.5 pt-1">
          <div className="flex justify-between items-center gap-2">
            <span className="shrink-0">Pool reserve:</span>
            <span className="font-mono font-bold text-[var(--ink)] truncate text-right">
              {poolTokens.toLocaleString()} ({poolReservePct}%)
            </span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="shrink-0">Creator mint:</span>
            <span className="font-mono font-bold text-[var(--ink)] truncate text-right">
              {creatorTokens.toLocaleString()} ({creatorPct}%)
            </span>
          </div>
        </div>
      </div>

      {/* 3. Launch Summary Card */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-sm space-y-2 text-xs">
        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ink-muted)]">
          Configuration Summary
        </span>

        <div className="space-y-1.5 pt-1 text-[var(--ink-muted)]">
          <div className="flex justify-between items-center gap-2">
            <span>Supply:</span>
            <span className="font-mono font-bold text-[var(--ink)]">1B Fixed</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span>Contract prefix:</span>
            <span className="font-mono font-bold text-[var(--ink)]">
              {grinding ? "Grinding…" : shortAddr(vanityAddress)}
            </span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span>Creator revenue:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              0.25% per swap
            </span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span>LP Lock:</span>
            <span className="font-mono font-bold text-[var(--ink)]">
              {liquidityLocked ? `${lockDurationDays} days` : "Unlocked"}
            </span>
          </div>
        </div>

        {/* Estimated Cost Row */}
        <div className="pt-2 border-t border-[var(--border-subtle)]/60 flex justify-between items-center text-xs flex-wrap gap-1">
          <span className="font-bold text-[var(--ink)]">Estimated Cost:</span>
          <span className="font-mono font-bold text-[var(--brand-text)]">
            {seedEthNum > 0 ? `${seedEthNum} ETH + ` : ""}~$0.04 gas
          </span>
        </div>
      </div>

      {/* Clear Draft Option */}
      {onClearDraft && (
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onClearDraft}
            className="text-[11px] text-[var(--ink-dim)] hover:text-red-500 hover:underline transition py-1.5 min-h-[36px]"
          >
            Clear saved draft
          </button>
        </div>
      )}
    </div>
  );

  if (desktopOnly) {
    return <div className="sticky top-24 space-y-4">{content}</div>;
  }

  if (mobileOnly) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 shadow-xs mb-4">
        <button
          type="button"
          onClick={() => setMobileExpanded((p) => !p)}
          className="w-full flex items-center justify-between text-xs font-bold text-[var(--ink)] cursor-pointer min-h-[44px]"
          aria-expanded={mobileExpanded}
          aria-label="Toggle Live Preview & Launch Summary"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0052FF] dark:bg-[#3888ff] shrink-0" />
            <span className="truncate">Live Preview &amp; Launch Summary</span>
            <span className="text-[11px] font-mono font-bold text-[var(--brand-text)] shrink-0">
              ${displaySymbol}
            </span>
          </div>
          <span className="text-[var(--ink-muted)] shrink-0 ml-2">
            {mobileExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </button>

        {mobileExpanded && (
          <div className="pt-3 mt-2 border-t border-[var(--border-subtle)] animate-meridian-fade">
            {content}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Desktop Sticky Column */}
      <div className="hidden md:block sticky top-24 space-y-4">
        {content}
      </div>

      {/* Mobile Collapsible Drawer Bar */}
      <div className="block md:hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 shadow-xs mb-4">
        <button
          type="button"
          onClick={() => setMobileExpanded((p) => !p)}
          className="w-full flex items-center justify-between text-xs font-bold text-[var(--ink)] cursor-pointer min-h-[44px]"
          aria-expanded={mobileExpanded}
          aria-label="Toggle Live Preview & Launch Summary"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0052FF] dark:bg-[#3888ff] shrink-0" />
            <span className="truncate">Live Preview &amp; Launch Summary</span>
            <span className="text-[11px] font-mono font-bold text-[var(--brand-text)] shrink-0">
              ${displaySymbol}
            </span>
          </div>
          <span className="text-[var(--ink-muted)] shrink-0 ml-2">
            {mobileExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </button>

        {mobileExpanded && (
          <div className="pt-3 mt-2 border-t border-[var(--border-subtle)] animate-meridian-fade">
            {content}
          </div>
        )}
      </div>
    </>
  );
}
