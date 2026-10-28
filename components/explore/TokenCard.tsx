"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Copy,
  Check,
  MoreHorizontal,
  ExternalLink,
  ShieldAlert,
  Star,
  ArrowRight,
} from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import {
  formatCompactUsd,
  formatExactUsd,
  isLowLiquidity,
  isExtremeMove,
  isNewToken,
} from "@/lib/explore/explore-config";
import { shortAddr } from "@/lib/launchpad/format";
import { basescanTxUrl } from "@/lib/utils/tx";
import TokenAvatar from "@/components/ui/TokenAvatar";
import { useCompliance } from "@/hooks/useCompliance";
import VerifiedBadge from "@/components/ui/VerifiedBadge";

interface TokenCardProps {
  token: UnifiedToken;
  onTrade: (token: UnifiedToken) => void;
  onSelect?: (token: UnifiedToken) => void;
  onToggleWatch?: (token: UnifiedToken) => void;
  isWatched?: boolean;
}

export default function TokenCard({
  token,
  onTrade,
  onSelect,
  onToggleWatch,
  isWatched = false,
}: TokenCardProps) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const compliance = useCompliance();

  const isStock = Boolean(
    token.type === "stock" ||
    token.type === "b20" ||
    token.symbol.endsWith("c")
  );
  const isStockSwapRestricted =
    isStock &&
    (!compliance.status.features["stocks.swap"] ||
      (compliance.isRestricted && !compliance.canEnter));

  const isUp = token.priceChange24h >= 0;
  const isZero = token.priceChange24h === 0;

  // Badges (at most two)
  // Badge 1: Token Type
  const typeBadge =
    token.type === "b20"
      ? { label: "B20", class: "bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand)]/20" }
      : token.type === "stock"
        ? { label: "Stock", class: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" }
        : { label: "Base", class: "bg-[var(--surface-2)] text-[var(--ink-muted)] border-[var(--border-subtle)]" };

  // Badge 2: Status / Risk Flag
  let statusBadge: { label: string; class: string; tooltip: string } | null = null;
  if (!token.hasPool) {
    statusBadge = {
      label: "No Pool",
      class: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
      tooltip: "No active liquidity pool detected on DEX.",
    };
  } else if (isLowLiquidity(token)) {
    statusBadge = {
      label: "Low Liq",
      class: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
      tooltip: `Liquidity is under $10,000 (${formatCompactUsd(token.liquidityUsd)}). High price impact likely.`,
    };
  } else if (isExtremeMove(token)) {
    statusBadge = {
      label: "Extreme Move",
      class: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
      tooltip: `24h price change exceeds ±50% (${token.priceChange24h.toFixed(1)}%). Elevated volatility.`,
    };
  } else if (isNewToken(token)) {
    statusBadge = {
      label: "New",
      class: "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/25",
      tooltip: "Created within the last 24 hours.",
    };
  } else {
    statusBadge = {
      label: "Pooled",
      class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      tooltip: "Has an active liquidity pool on Base DEX.",
    };
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(token.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(token);
    } else {
      onTrade(token);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="pop-lg group relative flex flex-col justify-between h-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-card transition-all cursor-pointer"
    >
      <div className="space-y-3">
        {/* Top Header: Logo, Name & Symbol, 24h Change, Watch Star */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <TokenAvatar
              src={token.imageUrl}
              address={token.address}
              symbol={token.symbol}
              className="w-10 h-10 rounded-xl"
            />

            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h3
                  title={token.name}
                  className="font-bold text-sm text-[var(--ink)] leading-snug line-clamp-1 group-hover:text-[var(--brand-text)] transition-colors"
                >
                  {token.name}
                </h3>
                {token.isVerified && <VerifiedBadge size={13} />}
              </div>
              <p className="font-mono text-xs text-[var(--ink-muted)] truncate">
                ${token.symbol}
              </p>
            </div>
          </div>

          {/* Right: 24h Change & Watch Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${
                isZero
                  ? "bg-[var(--surface-2)] text-[var(--ink-muted)]"
                  : isUp
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              }`}
            >
              {isUp && !isZero ? (
                <TrendingUp size={12} />
              ) : !isZero ? (
                <TrendingDown size={12} />
              ) : null}
              <span>
                {isUp && !isZero ? "+" : ""}
                {token.priceChange24h.toFixed(1)}%
              </span>
            </span>

            {onToggleWatch && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWatch(token);
                }}
                className="p-1 rounded-lg text-[var(--ink-muted)] hover:text-amber-500 hover:bg-[var(--surface-2)] transition"
                title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
              >
                <Star
                  size={14}
                  className={isWatched ? "fill-amber-500 text-amber-500" : ""}
                />
              </button>
            )}
          </div>
        </div>

        {/* Badges Row: at most two badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${typeBadge.class}`}
          >
            {typeBadge.label}
          </span>

          {statusBadge && (
            <span
              title={statusBadge.tooltip}
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 ${statusBadge.class}`}
            >
              {statusBadge.label !== "Pooled" && <ShieldAlert size={10} />}
              <span>{statusBadge.label}</span>
            </span>
          )}
        </div>

        {/* Price Row */}
        <div className="pt-1">
          <span className="text-[10px] text-[var(--ink-muted)] block">Price</span>
          <p className="text-base font-mono font-black text-[var(--ink)] tabular-nums">
            {formatExactUsd(token.priceUsd)}
          </p>
        </div>

        {/* Metrics Row: Market Cap, 24h Volume, Liquidity with exact tooltips */}
        <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-xs">
          <div title={`Exact Market Cap: ${formatExactUsd(token.marketCapUsd)}`}>
            <span className="text-[10px] text-[var(--ink-muted)] block truncate">Mkt Cap</span>
            <span className="font-mono font-bold text-[var(--ink)] tabular-nums text-[11px] block truncate">
              {formatCompactUsd(token.marketCapUsd)}
            </span>
          </div>

          <div title={`Exact 24h Volume: ${formatExactUsd(token.volume24h)}`}>
            <span className="text-[10px] text-[var(--ink-muted)] block truncate">24h Vol</span>
            <span className="font-mono font-bold text-[var(--ink)] tabular-nums text-[11px] block truncate">
              {formatCompactUsd(token.volume24h)}
            </span>
          </div>

          <div title={`Exact Liquidity: ${formatExactUsd(token.liquidityUsd)}`}>
            <span className="text-[10px] text-[var(--ink-muted)] block truncate">Liquidity</span>
            <span className="font-mono font-bold text-[var(--ink)] tabular-nums text-[11px] block truncate">
              {formatCompactUsd(token.liquidityUsd)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Row: Copyable Address, Swap Button, ⋯ Menu */}
      <div className="pt-3 mt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
        {/* Copy Address Chip */}
        <button
          type="button"
          onClick={handleCopy}
          className="pop-pill flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--ink-muted)] hover:text-[var(--ink)] transition cursor-pointer"
          title={`Copy address: ${token.address}`}
        >
          {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
          <span>{shortAddr(token.address)}</span>
        </button>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 relative">
          <button
            type="button"
            disabled={isStockSwapRestricted}
            onClick={(e) => {
              e.stopPropagation();
              if (isStockSwapRestricted) return;
              onTrade(token);
            }}
            title={
              isStockSwapRestricted
                ? "Tokenized stock features are not available in your region"
                : "Swap"
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-[0.98] ${
              isStockSwapRestricted
                ? "bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] cursor-not-allowed opacity-60"
                : "btn-primary cursor-pointer"
            }`}
          >
            <span>Swap</span>
            <ArrowRight size={12} />
          </button>

          {/* ⋯ Menu */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev)}
            }
            className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition"
            title="More actions"
          >
            <MoreHorizontal size={14} />
          </button>

          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 bottom-full mb-1.5 w-44 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-popover)] p-1.5 shadow-xl z-20 space-y-1 text-xs animate-meridian-rise"
            >
              <a
                href={token.dexUrl || `https://dexscreener.com/base/${token.address}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--ink)] transition"
              >
                <span>DexScreener</span>
                <ExternalLink size={12} className="text-[var(--ink-muted)]" />
              </a>

              <a
                href={`https://basescan.org/token/${token.address}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--ink)] transition"
              >
                <span>Basescan</span>
                <ExternalLink size={12} className="text-[var(--ink-muted)]" />
              </a>

              <button
                type="button"
                onClick={(e) => {
                  handleCopy(e);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--ink)] transition"
              >
                <span>Copy Address</span>
                <Copy size={12} className="text-[var(--ink-muted)]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
