"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  BarChart3,
  Zap,
  Info,
} from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import {
  formatCompactUsd,
  formatExactUsd,
  isLowLiquidity,
  isExtremeMove,
} from "@/lib/explore/explore-config";
import { shortAddr, timeAgo } from "@/lib/launchpad/format";
import TokenAvatar from "@/components/ui/TokenAvatar";
import { buildSwapLink } from "@/lib/swap/swap-link";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import TokenSparkline from "@/components/ui/TokenSparkline";

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
  const [activeTab, setActiveTab] = useState<"overview" | "chart" | "swap">("overview");
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [quickAmountEth, setQuickAmountEth] = useState<string>("0.05");
  const [quickSide, setQuickSide] = useState<"buy" | "sell">("buy");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll and handle Escape key while drawer is open
  useEffect(() => {
    if (!token) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [token, onClose]);

  // Reset scroll and tab to overview when opening or switching tokens
  useEffect(() => {
    if (token) {
      setActiveTab("overview");
      if (bodyRef.current) {
        bodyRef.current.scrollTo({ top: 0, behavior: "instant" });
      }
    }
  }, [token]);

  if (!mounted || !token) return null;

  const isUp = token.priceChange24h >= 0;
  const isZero = token.priceChange24h === 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(token.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const url = `${window.location.origin}${buildSwapLink({ buy: token.address })}`;
    navigator.clipboard.writeText(url);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  // Approximate token amount calculation for quick swap preview
  const estimatedTokenOutput = (() => {
    const ethAmount = parseFloat(quickAmountEth) || 0;
    const ethPriceUsd = 2600; // estimated reference ETH price
    const usdValue = ethAmount * ethPriceUsd;
    if (token.priceUsd > 0 && usdValue > 0) {
      const tokens = usdValue / token.priceUsd;
      return tokens >= 1000000
        ? `${(tokens / 1000000).toFixed(2)}M`
        : tokens >= 1000
        ? `${(tokens / 1000).toFixed(2)}K`
        : tokens.toFixed(2);
    }
    return "0.00";
  })();

  const chartEmbedUrl = `https://dexscreener.com/base/${token.pairAddress || token.address}?embed=1&theme=dark&trades=0&info=0`;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:justify-end bg-[var(--overlay)] backdrop-blur-xs transition-opacity animate-meridian-fade"
      role="dialog"
      aria-modal="true"
      aria-label={`${token.name} Quick View`}
    >
      {/* Drawer Container (Slide-over desktop, bottom sheet on mobile) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[88dvh] sm:max-h-full sm:h-full bg-[var(--surface-3)] border-t sm:border-l sm:border-t-0 border-[var(--border-subtle)] sm:shadow-2xl flex flex-col overflow-hidden rounded-t-3xl sm:rounded-none animate-meridian-rise"
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="pt-2.5 pb-0.5 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1 bg-[var(--border-strong)] rounded-full opacity-60" />
        </div>

        {/* Top Header - Fixed at top of drawer */}
        <div className="p-5 pb-3 border-b border-[var(--border-subtle)] space-y-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <TokenAvatar
                src={token.imageUrl}
                address={token.address}
                symbol={token.symbol}
                className="w-12 h-12 rounded-2xl shadow-xs shrink-0"
                textClassName="text-sm"
              />

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-[var(--ink)] tracking-tight truncate">
                    {token.name}
                  </h2>
                  {token.isVerified && <VerifiedBadge size={16} />}
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
                    {token.type.toUpperCase()}
                  </span>
                </div>
                <p className="font-mono text-xs text-[var(--ink-muted)] truncate">${token.symbol}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition cursor-pointer shrink-0"
              title="Close drawer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Price & 24h Change Row */}
          <div className="flex items-baseline justify-between pt-0.5">
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

          {/* Tab Switcher: Overview / Live Chart / Quick Swap */}
          <div className="flex items-center gap-1 p-1 bg-[var(--surface-2)] rounded-xl border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                activeTab === "overview"
                  ? "bg-[var(--surface-3)] text-[var(--ink)] shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              <Info size={13} />
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("chart")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                activeTab === "chart"
                  ? "bg-[var(--surface-3)] text-[var(--ink)] shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              <BarChart3 size={13} />
              <span>Live Chart</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("swap")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                activeTab === "swap"
                  ? "bg-[var(--surface-3)] text-[var(--ink)] shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              <Zap size={13} />
              <span>Quick Swap</span>
            </button>
          </div>
        </div>

        {/* Drawer Body - Scrollable content area */}
        <div ref={bodyRef} className="p-5 space-y-5 flex-1 overflow-y-auto overscroll-contain">
          {activeTab === "overview" && (
            <>
              {/* 24h Trend Card with Sparkline */}
              <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--ink-muted)] tracking-wider block">
                    24H Price Trend
                  </span>
                  <span className="text-xs font-semibold text-[var(--ink)] mt-0.5 block">
                    {isUp ? "Bullish momentum" : "Bearish retracement"}
                  </span>
                </div>
                <TokenSparkline
                  change24h={token.priceChange24h}
                  seed={token.address}
                  width={110}
                  height={32}
                />
              </div>

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
            </>
          )}

          {activeTab === "chart" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--ink-muted)]">Live 15m DEX Candlestick</span>
                <a
                  href={token.dexUrl || `https://dexscreener.com/base/${token.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline font-semibold"
                >
                  <span>Fullscreen Chart</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              <div className="w-full h-[400px] rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-2)]">
                <iframe
                  src={chartEmbedUrl}
                  title={`${token.symbol} Live Chart`}
                  className="w-full h-full border-0"
                  loading="lazy"
                />
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-xs text-[var(--ink-muted)] flex items-center justify-between">
                <span>Pair Address: {shortAddr(token.pairAddress || token.address)}</span>
                <span className="font-mono text-emerald-500 font-bold">Base Network</span>
              </div>
            </div>
          )}

          {activeTab === "swap" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                  Instant Quick Trade
                </span>
                <div className="flex p-0.5 bg-[var(--surface-2)] rounded-lg border border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setQuickSide("buy")}
                    className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                      quickSide === "buy"
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "text-[var(--ink-muted)]"
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickSide("sell")}
                    className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                      quickSide === "sell"
                        ? "bg-red-500/20 text-red-600 dark:text-red-400"
                        : "text-[var(--ink-muted)]"
                    }`}
                  >
                    Sell
                  </button>
                </div>
              </div>

              {/* Amount Presets */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--ink-muted)] block">
                  {quickSide === "buy" ? "Pay with ETH" : `Sell ${token.symbol}`}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {["0.01", "0.05", "0.1", "0.25"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQuickAmountEth(preset)}
                      className={`py-2 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                        quickAmountEth === preset
                          ? "bg-[var(--surface)] border-[var(--color-primary)] text-[var(--color-primary)] shadow-xs"
                          : "bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {preset} ETH
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.001"
                      value={quickAmountEth}
                      onChange={(e) => setQuickAmountEth(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-sm font-mono font-bold text-[var(--ink)] focus:outline-hidden focus:border-[var(--color-primary)]"
                      placeholder="0.0"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-mono text-[var(--ink-muted)]">
                      ETH
                    </span>
                  </div>
                </div>
              </div>

              {/* Estimated Receive Box */}
              <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-2 text-xs">
                <div className="flex items-center justify-between text-[var(--ink-muted)]">
                  <span>Estimated Receive</span>
                  <span className="font-mono font-bold text-[var(--ink)]">
                    ≈ {estimatedTokenOutput} {token.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[var(--ink-muted)]">
                  <span>Target Network</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    Base Mainnet (8453)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[var(--ink-muted)]">
                  <span>Routing Protocol</span>
                  <span className="font-bold text-[var(--ink)]">Uniswap v3 / Aerodrome</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-xs text-[var(--ink)] flex items-center gap-2">
                <Zap size={15} className="text-[var(--color-primary)] shrink-0" />
                <span>
                  Click below to open full Swap view with optimal multi-hop routing, slippage control, and gas simulation.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions - Fixed at bottom of drawer */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-2)] flex items-center gap-2.5 shrink-0">
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
    </div>,
    document.body
  );
}
