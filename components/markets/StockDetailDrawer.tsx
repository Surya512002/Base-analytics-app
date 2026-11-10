"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Star,
} from "lucide-react";
import type { StockMarketItem } from "@/lib/markets/types";
import { OFFICIAL_TRADE_VENUES } from "@/lib/markets/types";
import { computeTradeSafety } from "@/lib/markets/price-impact-service";

interface StockDetailDrawerProps {
  stock: StockMarketItem | null;
  open: boolean;
  onClose: () => void;
  isWatched?: boolean;
  onToggleWatchlist?: (address: string) => void;
}

function formatUsdLarge(val: number | null | undefined): string {
  if (val == null || isNaN(val) || val <= 0) return "—";
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function StockDetailDrawer({
  stock,
  open,
  onClose,
  isWatched = false,
  onToggleWatchlist,
}: StockDetailDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [showAllVenues, setShowAllVenues] = useState(false);

  if (!open || !stock) return null;

  const safety = computeTradeSafety(stock.priceImpact10k);
  const displayedVenues = showAllVenues
    ? OFFICIAL_TRADE_VENUES
    : OFFICIAL_TRADE_VENUES.slice(0, 4);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(stock.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-fade-in">
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-lg bg-[var(--surface)] border-l border-[var(--border-subtle)] h-full overflow-y-auto flex flex-col justify-between shadow-2xl p-6 space-y-6 z-10 animate-slide-left">
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center font-black text-sm text-[var(--ink)] shadow-xs">
                {stock.underlyingTicker.slice(0, 3)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-[var(--ink)] tracking-tight">
                    {stock.symbol}
                  </h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)]">
                    {stock.underlyingTicker}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    1:1 Backed
                  </span>
                </div>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">{stock.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {onToggleWatchlist && (
                <button
                  type="button"
                  onClick={() => onToggleWatchlist(stock.address)}
                  className="p-2 rounded-xl text-[var(--ink-muted)] hover:text-amber-500 hover:bg-[var(--surface-2)] transition"
                  aria-label="Toggle Watchlist"
                >
                  <Star
                    size={18}
                    className={isWatched ? "fill-amber-400 text-amber-500" : ""}
                  />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition"
                aria-label="Close drawer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Price & 24h Performance Card */}
          <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-[var(--ink-muted)] block font-medium">Token Price</span>
                <div className="text-3xl font-black text-[var(--ink)] tabular-nums tracking-tight">
                  ${stock.price.toFixed(2)}
                </div>
              </div>
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold tabular-nums ${
                  stock.change24h >= 0
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                }`}
              >
                {stock.change24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>
                  {stock.change24h >= 0 ? "+" : ""}
                  {stock.change24h.toFixed(2)}% (24h)
                </span>
              </div>
            </div>

            {/* 7-Day Sparkline */}
            {stock.priceWeek && stock.priceWeek.length > 1 && (
              <div className="pt-2">
                <div className="flex items-center justify-between text-[10px] text-[var(--ink-muted)] mb-1">
                  <span>7-Day Price Trend</span>
                  <span className="tabular-nums font-semibold text-[var(--ink)]">
                    Low: ${Math.min(...stock.priceWeek.map((p) => p.value)).toFixed(2)} · High: ${Math.max(...stock.priceWeek.map((p) => p.value)).toFixed(2)}
                  </span>
                </div>
                <div className="h-10 w-full flex items-end gap-1">
                  {stock.priceWeek.map((pt, i) => {
                    const vals = stock.priceWeek.map((p) => p.value);
                    const min = Math.min(...vals);
                    const max = Math.max(...vals);
                    const range = max - min || 1;
                    const hPct = Math.max(15, Math.min(100, ((pt.value - min) / range) * 100));

                    return (
                      <div
                        key={i}
                        className="flex-1 bg-[#0052FF]/30 hover:bg-[#0052FF] rounded-t transition-all group relative cursor-pointer"
                        style={{ height: `${hPct}%` }}
                        title={`${pt.date}: $${pt.value.toFixed(2)}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] space-y-1">
              <span className="text-[11px] text-[var(--ink-muted)] font-medium flex items-center gap-1">
                Trading Liquidity
              </span>
              <div className="text-base font-bold text-[var(--ink)] tabular-nums">
                {formatUsdLarge(stock.tradingLiquidity)}
              </div>
              <span className="text-[10px] text-[var(--ink-muted)] block">Aerodrome USDC pool</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] space-y-1">
              <span className="text-[11px] text-[var(--ink-muted)] font-medium flex items-center gap-1">
                Impact on $10K
              </span>
              <div>
                <span
                  className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold border tabular-nums ${safety.badgeColorClass}`}
                >
                  {safety.badgeLabel}
                </span>
              </div>
              <span className="text-[10px] text-[var(--ink-muted)] block">Real market order impact</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] space-y-1 col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--ink-muted)] font-medium flex items-center gap-1">
                  Used as Collateral in DeFi
                </span>
                <span className="text-base font-bold text-[var(--ink)] tabular-nums">
                  {formatUsdLarge(stock.usedAsCollateral)}
                </span>
              </div>
              <div className="text-[10px] text-[var(--ink-muted)] flex items-center justify-between pt-1">
                <span>Morpho Blue · Moonwell · Euler</span>
                <Link
                  href={`/lend?stock=${stock.symbol}`}
                  className="text-[#0052FF] font-bold hover:underline inline-flex items-center gap-0.5"
                >
                  <span>View lending markets</span>
                  <ArrowRight size={10} />
                </Link>
              </div>
            </div>
          </div>

          {/* Contract Address & External Links */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[var(--ink-muted)] uppercase tracking-wider">
              Token Contract
            </h4>
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
              <div className="flex flex-col min-w-0 pr-2">
                <span className="text-[11px] font-mono text-[var(--ink)] truncate max-w-[280px]">
                  {stock.address}
                </span>
                <span className="text-[10px] text-[var(--ink-muted)]">
                  Base B20 Native Precompile
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition"
                  title="Copy contract address"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
                <a
                  href={`https://basescan.org/token/${stock.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition"
                  title="View on Basescan"
                >
                  <ExternalLink size={14} />
                </a>
                {stock.prospectusUrl && (
                  <a
                    href={stock.prospectusUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition"
                    title="Official Prospectus PDF"
                  >
                    <FileText size={14} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Supported Trade Venues */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[var(--ink-muted)] uppercase tracking-wider">
                Trade Venues
              </h4>
              <button
                type="button"
                onClick={() => setShowAllVenues((prev) => !prev)}
                className="text-xs text-[#0052FF] font-bold hover:underline"
              >
                {showAllVenues ? "Show fewer" : `View all (${OFFICIAL_TRADE_VENUES.length})`}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {displayedVenues.map((venue) => (
                <a
                  key={venue.name}
                  href={venue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-2)]/60 hover:bg-[var(--surface-2)] border border-[var(--border-subtle)] transition group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center font-bold text-[10px] text-[var(--ink)] shrink-0">
                      {venue.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-[var(--ink)] block truncate">
                        {venue.name}
                      </span>
                      <span className="text-[10px] text-[var(--ink-muted)] block truncate max-w-[280px]">
                        {venue.description}
                      </span>
                    </div>
                  </div>
                  <ExternalLink
                    size={12}
                    className="text-[var(--ink-muted)] group-hover:text-[var(--ink)] transition shrink-0 ml-2"
                  />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Sticky Action Bar */}
        <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
          <Link
            href={`/swap?buy=${stock.address}`}
            onClick={onClose}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#0052FF] text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition shadow-md"
          >
            <span>Trade {stock.symbol} on Base</span>
            <ArrowRight size={16} />
          </Link>

          <p className="text-[10px] text-[var(--ink-muted)] text-center leading-normal">
            Information only, not investment advice. Reported liquidity does not guarantee completion at a specific price.
          </p>
        </div>
      </div>
    </div>
  );
}
