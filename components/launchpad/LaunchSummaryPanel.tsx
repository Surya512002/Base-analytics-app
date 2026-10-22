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
    <div className="space-y-4">
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

        <div className="flex items-start gap-3.5">
          <TokenLogo
            symbol={displaySymbol}
            src={imagePreview}
            size={56}
            shape="rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-sm text-[var(--ink)] truncate">{displayName}</h3>
            <p className="font-mono text-xs font-bold text-[var(--brand-text)]">${displaySymbol}</p>
            <p className="text-[11px] text-[var(--ink-muted)] mt-0.5">
              Pair: <span className="font-mono font-bold text-[var(--ink)]">${displaySymbol} / {quoteSymbol}</span>
            </p>
          </div>
        </div>

        {description.trim() ? (
          <p className="text-xs text-[var(--ink-muted)] line-clamp-2 leading-relaxed pt-1 border-t border-[var(--border-subtle)]/40">
            {description}
          </p>
        ) : (
          <p className="text-[11px] text-[var(--ink-dim)] italic pt-1 border-t border-[var(--border-subtle)]/40">
            Add a description in Step 2…
          </p>
        )}

        {(website.trim() || twitter.trim()) && (
          <div className="flex items-center gap-3 text-[11px] text-[var(--ink-muted)] pt-1">
            {website.trim() && (
              <span className="inline-flex items-center gap-1">
                <Globe size={11} /> Website
              </span>
            )}
            {twitter.trim() && (
              <span className="inline-flex items-center gap-1">
                <Twitter size={11} /> X
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
          <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--ink-muted)]">Starting Price</span>
            <p className="text-xs font-mono font-bold text-[var(--ink)]" title={`Exact: $${startPriceUsd}`}>
              {readablePrice}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--ink-muted)]">Implied Market Cap</span>
            <p className="text-xs font-mono font-bold text-[var(--ink)]">
              ${impliedMcap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div className="text-xs text-[var(--ink-muted)] space-y-1.5 pt-1">
          <div className="flex justify-between">
            <span>Pool reserve:</span>
            <span className="font-mono font-bold text-[var(--ink)]">
              {poolTokens.toLocaleString()} tokens ({poolReservePct}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span>Creator mint:</span>
            <span className="font-mono font-bold text-[var(--ink)]">
              {creatorTokens.toLocaleString()} tokens ({creatorPct}%)
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
          <div className="flex justify-between">
            <span>Supply:</span>
            <span className="font-mono font-bold text-[var(--ink)]">1B Fixed</span>
          </div>
          <div className="flex justify-between">
            <span>Contract prefix:</span>
            <span className="font-mono font-bold text-[var(--ink)]">
              {grinding ? "Grinding…" : shortAddr(vanityAddress)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Creator revenue:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              0.25% per swap
            </span>
          </div>
          <div className="flex justify-between">
            <span>LP Lock:</span>
            <span className="font-mono font-bold text-[var(--ink)]">
              {liquidityLocked ? `${lockDurationDays} days` : "Unlocked"}
            </span>
          </div>
        </div>

        {/* Estimated Cost Row */}
        <div className="pt-2 border-t border-[var(--border-subtle)]/60 flex justify-between items-center text-xs">
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
            className="text-[11px] text-[var(--ink-dim)] hover:text-red-500 hover:underline transition"
          >
            Clear saved draft
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Column */}
      <div className="hidden lg:block sticky top-24 space-y-4">
        {content}
      </div>

      {/* Mobile Collapsible Drawer Bar */}
      <div className="block lg:hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
        <button
          type="button"
          onClick={() => setMobileExpanded((p) => !p)}
          className="w-full flex items-center justify-between text-xs font-bold text-[var(--ink)] cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--brand)]" />
            <span>Live Preview &amp; Summary</span>
            <span className="text-[11px] font-mono text-[var(--brand-text)]">${displaySymbol}</span>
          </div>
          <span className="text-[var(--ink-muted)]">
            {mobileExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        {mobileExpanded && <div className="pt-3 mt-3 border-t border-[var(--border-subtle)]">{content}</div>}
      </div>
    </>
  );
}
