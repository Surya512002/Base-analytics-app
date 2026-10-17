"use client";

import { useMemo } from "react";
import { ArrowUpRight, Command, Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { formatSubscriptPrice, formatUsd } from "@/lib/launchpad/format";
import { pickB20Spotlight } from "@/lib/launchpad/explore-rankings";
import { isB20ExploreToken } from "@/lib/launchpad/token-meta";

export default function ExploreLandingHero({
  tokens,
  b20Tokens,
  markets,
  marketLoading,
  guestMode,
  onLaunch,
  onOpenToken,
  onConnect,
  onBrowseTrending,
  onConnectToTrade,
  totalVolume24h,
}: {
  tokens: LaunchedToken[];
  b20Tokens?: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
  marketLoading?: boolean;
  guestMode?: boolean;
  onLaunch: () => void;
  onOpenToken: (t: LaunchedToken) => void;
  onConnect?: () => void;
  onBrowseTrending?: () => void;
  onConnectToTrade?: () => void;
  totalVolume24h?: number;
  totalLiquidity?: number;
}) {
  const spotlight = useMemo(() => {
    const pool = (b20Tokens?.length ? b20Tokens : tokens.filter(isB20ExploreToken)).length
      ? b20Tokens?.length
        ? b20Tokens
        : tokens.filter(isB20ExploreToken)
      : tokens;
    return pickB20Spotlight(pool, markets);
  }, [tokens, b20Tokens, markets]);

  const chg = spotlight?.market?.priceChange24h ?? 0;
  const isUp = chg >= 0;
  const tradableCount = tokens.length;

  return (
    <section className="w-full min-w-0 mb-6 sm:mb-8">
      {/* Single Consolidated Section Box */}
      <div className="brand-hero-wrap animate-meridian-rise relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-card transition-colors">
        {/* Full-bleed illustration backdrop */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/base-analytics-hero-lanes.png"
          alt=""
          className="brand-hero-img opacity-40 dark:opacity-20 pointer-events-none"
          aria-hidden
        />
        {/* Theme-adaptive gradient overlay for razor-sharp typography contrast */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-[var(--surface)] via-[var(--surface)]/95 to-[var(--surface)]/80 dark:from-[var(--surface)] dark:via-[var(--surface)]/95 dark:to-[var(--surface)]/85 pointer-events-none"
          aria-hidden
        />
        {/* Iconic bottom accent rail */}
        <div className="lane-rail absolute bottom-0 left-0 right-0 h-1 z-[2]" aria-hidden />

        {/* Content Container */}
        <div className="relative z-10 p-5 sm:p-7 md:p-8">
          <div className="grid lg:grid-cols-[1.25fr_1fr] xl:grid-cols-[1.3fr_1fr] gap-6 lg:gap-8 items-center">
            {/* Left Column: Brand, Discovery Headline & Core Actions */}
            <div className="space-y-4 sm:space-y-5">
              {/* Eyebrow & Live Status Row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-brand inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
                  <span className="live-dot" style={{ width: 6, height: 6 }} />
                  B20 Launchpad · Live on Base
                </span>
                <span className="rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] px-2.5 py-0.5 text-[11px] font-mono font-semibold">
                  {marketLoading
                    ? "Syncing markets…"
                    : `${tradableCount} tradable tokens${totalVolume24h ? ` · ${formatUsd(totalVolume24h)} 24h vol` : ""}`}
                </span>
              </div>

              {/* Combined Headline & Body */}
              <div>
                <h1 className="font-display text-2xl sm:text-3xl lg:text-[2.25rem] font-extrabold text-[var(--ink)] tracking-tight leading-[1.15]">
                  Discover tokens.
                  <br />
                  <span className="text-[var(--brand)]">Swap without leaving.</span>
                </h1>
                <p className="mt-2.5 text-[14px] sm:text-[15px] text-[var(--ink-muted)] leading-relaxed max-w-xl">
                  B20 launchpad, live liquidity rails, and in-app DEX routing — trade on Uniswap,
                  Aerodrome, or Slipstream with real-time USD quotes.
                </p>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
                <button
                  type="button"
                  onClick={onBrowseTrending}
                  className="btn-primary inline-flex items-center justify-center gap-2 min-h-[42px] px-4 sm:px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all shadow-sm touch-manipulation"
                >
                  <TrendingUp size={16} />
                  Browse trending
                </button>

                {guestMode ? (
                  <>
                    <button
                      type="button"
                      onClick={onConnectToTrade ?? onConnect}
                      className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 sm:px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[14px] font-bold text-[var(--ink)] hover:bg-[var(--border-subtle)] transition-colors touch-manipulation"
                    >
                      <Wallet size={16} />
                      Connect to trade
                    </button>
                    <button
                      type="button"
                      onClick={onLaunch}
                      className="inline-flex items-center justify-center gap-2 min-h-[42px] px-3.5 sm:px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[14px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--border-strong)] transition-colors touch-manipulation"
                    >
                      <Plus size={16} />
                      Launch B20
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={onLaunch}
                    className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 sm:px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[14px] font-bold text-[var(--ink)] hover:bg-[var(--border-subtle)] transition-colors touch-manipulation"
                  >
                    <Plus size={16} />
                    Launch token
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
                  className="inline-flex items-center justify-center gap-2 min-h-[42px] px-3.5 sm:px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[14px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--border-strong)] transition-colors touch-manipulation"
                >
                  <Command size={15} />
                  Search
                  <kbd className="hidden sm:inline text-[10px] font-mono text-[var(--ink-dim)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5">
                    ⌘K
                  </kbd>
                </button>
              </div>
            </div>

            {/* Right Column: Integrated Spotlight Card */}
            {spotlight && (
              <div
                onClick={() => onOpenToken(spotlight.token)}
                className="group cursor-pointer rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)]/90 backdrop-blur-md p-4 sm:p-5 shadow-sm hover:border-[var(--brand)] hover:shadow-md transition-all relative overflow-hidden"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenToken(spotlight.token);
                  }
                }}
                aria-label={`Open ${spotlight.token.name} spotlight`}
              >
                {/* Spotlight Top Accent Line */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[var(--brand)] to-blue-400"
                  aria-hidden
                />

                {/* Spotlight Header Row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {spotlight.token.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={spotlight.token.imageUrl}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover border border-[var(--border-strong)] shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] flex items-center justify-center text-lg font-black text-[var(--ink)] shrink-0 shadow-sm">
                        {spotlight.token.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="spotlight-badge mb-1 text-[9px] px-2 py-0.5">
                        <span className="live-dot" style={{ width: 5, height: 5 }} />
                        B20 Spotlight
                      </span>
                      <h3 className="font-display text-base sm:text-lg font-bold text-[var(--ink)] tracking-tight truncate leading-tight group-hover:text-[var(--brand)] transition-colors">
                        {spotlight.token.name}
                      </h3>
                      <p className="text-xs text-[var(--ink-muted)] font-mono font-semibold">
                        ${spotlight.token.symbol}
                      </p>
                    </div>
                  </div>

                  {/* Price & 24h Change */}
                  {spotlight.market?.priceUsd != null && (
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm sm:text-base font-bold text-[var(--ink)] tabular-nums">
                        {formatSubscriptPrice(spotlight.market.priceUsd)}
                      </p>
                      <span
                        className={`inline-flex items-center gap-0.5 mt-0.5 text-xs font-bold tabular-nums ${
                          isUp
                            ? "text-emerald-500 dark:text-emerald-400"
                            : "text-rose-500 dark:text-rose-400"
                        }`}
                      >
                        {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {isUp ? "+" : ""}
                        {chg.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* 4 Metrics Strip */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    {
                      label: "Vol 24h",
                      value: spotlight.market?.volume24h
                        ? formatUsd(spotlight.market.volume24h)
                        : "—",
                    },
                    {
                      label: "Liquidity",
                      value: spotlight.market?.liquidityUsd
                        ? formatUsd(spotlight.market.liquidityUsd)
                        : "—",
                    },
                    {
                      label: "MCap",
                      value: spotlight.market?.marketCap
                        ? formatUsd(spotlight.market.marketCap)
                        : "—",
                    },
                    { label: "Pool", value: spotlight.market?.hasPool ? "Live" : "Seed" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] p-2 text-center"
                    >
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">
                        {stat.label}
                      </p>
                      <p className="text-xs font-bold font-mono text-[var(--ink)] truncate mt-0.5">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Action Button & Supported DEXs */}
                <div className="space-y-1.5">
                  <span className="btn-primary w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold shadow-sm group-hover:bg-[var(--brand-dark)] transition">
                    Trade in-app
                    <ArrowUpRight size={14} />
                  </span>
                  <p className="text-[10px] text-[var(--ink-dim)] text-center">
                    Aerodrome · Uniswap · Slipstream
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
