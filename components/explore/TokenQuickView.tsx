"use client";

import React, { useState } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Star,
  Share2,
  ArrowRight,
  Globe,
  Coins,
  ShieldCheck,
} from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import {
  formatCompactUsd,
  formatExactUsd,
  isLowLiquidity,
  isExtremeMove,
  isNewToken,
} from "@/lib/explore/explore-config";
import { shortAddr, timeAgo } from "@/lib/launchpad/format";
import TokenAvatar from "@/components/ui/TokenAvatar";

interface TokenQuickViewProps {
  token: UnifiedToken | null;
  onClose: () => void;
  onTrade: (token: UnifiedToken) => void;
  onToggleWatch?: (token: UnifiedToken) => void;
  isWatched?: boolean;
}

export default function TokenQuickView({
  token,
  onClose,
  onTrade,
  onToggleWatch,
  isWatched = false,
}: TokenQuickViewProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  if (!token) return null;

  const isUp = token.priceChange24h >= 0;
  const isZero = token.priceChange24h === 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(token.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/swap?token=${token.address}`;
    navigator.clipboard.writeText(url);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-[var(--overlay)] backdrop-blur-xs transition-opacity animate-meridian-fade"
    >
      {/* Drawer Container (Slide-over desktop, bottom sheet on mobile) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md h-[90vh] sm:h-full bg-[var(--surface-3)] border-t sm:border-l sm:border-t-0 border-[var(--border-subtle)] sm:shadow-2xl flex flex-col justify-between overflow-y-auto rounded-t-3xl sm:rounded-none animate-meridian-rise"
      >
        {/* Top Header */}
        <div className="p-5 pb-4 border-b border-[var(--border-subtle)] space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <TokenAvatar
                src={token.imageUrl}
                address={token.address}
                symbol={token.symbol}
                className="w-12 h-12 rounded-2xl shadow-xs"
                textClassName="text-sm"
              />

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-[var(--ink)] tracking-tight">
                    {token.name}
                  </h2>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
                    {token.type.toUpperCase()}
                  </span>
                </div>
                <p className="font-mono text-xs text-[var(--ink-muted)]">${token.symbol}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition cursor-pointer"
              title="Close drawer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Price & 24h Change Row */}
          <div className="flex items-baseline justify-between pt-1">
            <div>
              <span className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider font-bold block">
                Live Price
              </span>
              <p className="text-2xl font-mono font-black text-[var(--ink)] tabular-nums mt-0.5">
                {formatExactUsd(token.priceUsd)}
              </p>
            </div>

            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono font-bold ${
                isZero
                  ? "bg-[var(--surface-2)] text-[var(--ink-muted)]"
                  : isUp
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              }`}
            >
              {isUp && !isZero ? (
                <TrendingUp size={14} />
              ) : !isZero ? (
                <TrendingDown size={14} />
              ) : null}
              <span>
                {isUp && !isZero ? "+" : ""}
                {token.priceChange24h.toFixed(2)}%
              </span>
            </span>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="p-5 space-y-5 flex-1 overflow-y-auto">
          {/* Risk Alerts (only when applicable) */}
          <div className="space-y-2">
            {!token.hasPool && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-200">
                <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">No Active Liquidity Pool</strong>
                  <span>This token has not been paired with liquidity on Uniswap or Aerodrome yet.</span>
                </div>
              </div>
            )}

            {isLowLiquidity(token) && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-200">
                <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Low Liquidity (&lt; $10,000)</strong>
                  <span>High slippage and price impact will occur on orders above $100.</span>
                </div>
              </div>
            )}

            {isExtremeMove(token) && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-200">
                <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Extreme 24h Volatility (±50%)</strong>
                  <span>Token has experienced significant price swings over the last 24 hours.</span>
                </div>
              </div>
            )}
          </div>

          {/* Key Stats Grid */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
              Market Metrics
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--ink-muted)] block">Market Cap</span>
                <p className="font-mono font-bold text-sm text-[var(--ink)] mt-0.5">
                  {formatCompactUsd(token.marketCapUsd)}
                </p>
                <span className="text-[9px] text-[var(--ink-dim)]">FDV on Base</span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--ink-muted)] block">24h Volume</span>
                <p className="font-mono font-bold text-sm text-[var(--ink)] mt-0.5">
                  {formatCompactUsd(token.volume24h)}
                </p>
                <span className="text-[9px] text-[var(--ink-dim)]">Uniswap &amp; Aerodrome</span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--ink-muted)] block">Total Liquidity</span>
                <p className="font-mono font-bold text-sm text-[var(--ink)] mt-0.5">
                  {formatCompactUsd(token.liquidityUsd)}
                </p>
                <span className="text-[9px] text-[var(--ink-dim)]">Pool reserves</span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--ink-muted)] block">Created</span>
                <p className="font-mono font-bold text-sm text-[var(--ink)] mt-0.5">
                  {token.createdAt ? timeAgo(token.createdAt) : "Verified"}
                </p>
                <span className="text-[9px] text-[var(--ink-dim)]">Base Mainnet</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {token.description && (
            <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-xs space-y-1">
              <span className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider block">
                About {token.name}
              </span>
              <p className="text-[var(--ink-muted)] leading-relaxed">
                {token.description}
              </p>
            </div>
          )}

          {/* Contract Address & External DEX Links */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
              Contract &amp; Verified Pools
            </h3>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-xs">
              <div>
                <span className="text-[10px] text-[var(--ink-muted)] block">Contract Address</span>
                <span className="font-mono font-bold text-[var(--ink)]">
                  {shortAddr(token.address)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition cursor-pointer"
                  title="Copy address"
                >
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>

                <a
                  href={`https://basescan.org/token/${token.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
                  title="View on Basescan"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <a
                href={token.dexUrl || `https://dexscreener.com/base/${token.address}`}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--ink)] font-bold flex items-center justify-between transition"
              >
                <span>DexScreener</span>
                <ExternalLink size={12} className="text-[var(--ink-muted)]" />
              </a>

              <button
                type="button"
                onClick={handleShare}
                className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--ink)] font-bold flex items-center justify-between transition cursor-pointer"
              >
                <span>{shared ? "Link Copied!" : "Share Link"}</span>
                {shared ? <Check size={12} className="text-emerald-500" /> : <Share2 size={12} className="text-[var(--ink-muted)]" />}
              </button>
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-2)] flex items-center gap-2.5">
          {onToggleWatch && (
            <button
              type="button"
              onClick={() => onToggleWatch(token)}
              className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-amber-500 transition cursor-pointer shrink-0"
              title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
            >
              <Star
                size={18}
                className={isWatched ? "fill-amber-500 text-amber-500" : ""}
              />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onClose();
              onTrade(token);
            }}
            className="flex-1 btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98] cursor-pointer"
          >
            <span>Trade ${token.symbol} on Base</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
