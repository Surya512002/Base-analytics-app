"use client";

import { useMemo } from "react";
import { ArrowUpRight, Command, Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { formatSubscriptPrice, formatUsd } from "@/lib/launchpad/format";
import { pickB20Spotlight } from "@/lib/launchpad/explore-rankings";
import { isB20ExploreToken } from "@/lib/launchpad/token-meta";
import BrandHeroBanner from "@/components/ui/BrandHeroBanner";

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

  return (
    <section className="explore-hero w-full min-w-0 pb-8 sm:pb-12 space-y-6">
      <BrandHeroBanner
        imageSrc="/brand/base-analytics-hero-lanes.png"
        eyebrow="B20 Launchpad · Live on Base"
        title="Discover & launch on Base"
        subtitle={
          marketLoading
            ? "Syncing markets…"
            : totalVolume24h
              ? `${formatUsd(totalVolume24h)} 24h volume`
              : "Live markets on Base"
        }
        minHeight="min-h-[220px] sm:min-h-[260px]"
        className="mb-2"
      >
        <button type="button" onClick={onLaunch} className="btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold">
          Launch token
        </button>
        {guestMode ? (
          <button type="button" onClick={onConnect} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold">
            <Wallet size={16} />
            Connect
          </button>
        ) : (
          <button type="button" onClick={onBrowseTrending} className="inline-flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold">
            Top movers
          </button>
        )}
      </BrandHeroBanner>

      {spotlight && (
        <button
          type="button"
          onClick={() => onOpenToken(spotlight.token)}
          className="spotlight-card group w-full text-left mb-8 sm:mb-10"
          aria-label={`Open ${spotlight.token.name} spotlight`}
        >
          <div className="spotlight-card-accent" aria-hidden />
          <div className="spotlight-card-body">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-8">
              <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
                {spotlight.token.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={spotlight.token.imageUrl}
                    alt=""
                    className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-2xl object-cover border border-[var(--border-strong)] shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] flex items-center justify-center text-xl sm:text-2xl font-black text-[var(--ink)] shrink-0">
                    {spotlight.token.symbol.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="spotlight-badge mb-2.5">
                    <span className="live-dot" style={{ width: 6, height: 6 }} />
                    B20 Spotlight
                  </span>
                  <h2 className="font-display text-2xl sm:text-[2rem] font-bold text-[var(--ink)] tracking-tight truncate leading-tight">
                    {spotlight.token.name}
                  </h2>
                  <p className="text-[15px] sm:text-base text-[var(--ink-muted)] font-mono font-semibold mt-1">
                    ${spotlight.token.symbol}
                  </p>
                  {spotlight.market?.priceUsd != null && (
                    <p className="text-[14px] text-[var(--ink-muted)] mt-2 font-mono tabular-nums">
                      {formatSubscriptPrice(spotlight.market.priceUsd)}
                      <span
                        className={`inline-flex items-center gap-0.5 ml-2 font-semibold ${
                          isUp ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {isUp ? "+" : ""}
                        {chg.toFixed(1)}%
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3 shrink-0 w-full lg:w-auto">
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
                  <div key={stat.label} className="spotlight-stat">
                    <p className="spotlight-stat-label">{stat.label}</p>
                    <p className="spotlight-stat-value">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex w-full flex-col items-stretch gap-2 sm:items-end lg:w-auto lg:flex-col">
                <span className="btn-primary inline-flex w-full items-center justify-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold sm:w-auto">
                  Trade in-app
                  <ArrowUpRight size={16} />
                </span>
                <span className="text-[11px] text-[var(--ink-dim)] text-center sm:text-right hidden sm:block">
                  Aerodrome · Uniswap · Slipstream
                </span>
              </div>
            </div>
          </div>
        </button>
      )}

      <div className="page-hero">
        <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-end">
        <div>
          <p className="section-eyebrow mb-2 sm:mb-3">Explore Base</p>
          <h1 className="page-hero-title max-w-2xl">
            Discover tokens.
            <br />
            <span className="text-[var(--ink-muted)]">Swap without leaving.</span>
          </h1>
          <p className="mt-3 sm:mt-4 readable-body max-w-lg">
            B20 launchpad, live liquidity rails, and in-app DEX routing — trade on Uniswap or
            Aerodrome with USD quotes.
          </p>

          <div className="mt-5 sm:mt-7 flex flex-wrap items-center gap-2.5 sm:gap-3">
            {guestMode ? (
              <>
                <button
                  type="button"
                  onClick={onBrowseTrending}
                  className="btn-primary inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl text-[14px] font-bold transition-colors touch-manipulation"
                >
                  <TrendingUp size={16} />
                  Browse trending
                </button>
                <button
                  type="button"
                  onClick={onConnectToTrade ?? onConnect}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-hover)] text-[14px] font-bold text-[var(--ink)] hover:bg-[var(--bg-active)] transition-colors touch-manipulation"
                >
                  <Wallet size={16} />
                  Connect to trade
                </button>
                <button
                  type="button"
                  onClick={onLaunch}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[14px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors touch-manipulation"
                >
                  <Plus size={16} />
                  Launch B20
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onBrowseTrending}
                  className="btn-primary inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl text-[14px] font-bold transition-colors touch-manipulation"
                >
                  <TrendingUp size={16} />
                  Browse trending
                </button>
                <button
                  type="button"
                  onClick={onLaunch}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-hover)] text-[14px] font-bold text-[var(--ink)] hover:bg-[var(--bg-active)] transition-colors touch-manipulation"
                >
                  <Plus size={16} />
                  Launch B20 token
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[14px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--border-strong)] transition-colors touch-manipulation"
            >
              <Command size={15} />
              Search
              <kbd className="hidden sm:inline text-[10px] font-mono text-[var(--ink-dim)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5">
                ⌘K
              </kbd>
            </button>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
