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
    <section className="page-hero relative border-b border-white/[0.08] pb-8 sm:pb-12">
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mb-5 sm:mb-8">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
          <span className="live-dot" />
          B20 Launchpad · Live on Base
        </span>
        <span className="text-[12px] text-[var(--ink-dim)] font-mono">
          {marketLoading
            ? "Syncing markets…"
            : `${tradableCount} tradable${totalVolume24h ? ` · ${formatUsd(totalVolume24h)} 24h` : ""}`}
        </span>
      </div>

      {spotlight && (
        <button
          type="button"
          onClick={() => onOpenToken(spotlight.token)}
          className="spotlight-card group w-full text-left p-5 sm:p-8 mb-8 sm:mb-10 relative"
        >
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
            <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
              {spotlight.token.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={spotlight.token.imageUrl}
                  alt=""
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-white/15 shadow-lg shrink-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#0052FF]/25 border border-[#0052FF]/40 flex items-center justify-center text-xl sm:text-2xl font-black text-white shrink-0">
                  {spotlight.token.symbol.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="spotlight-badge mb-3">
                  <span className="live-dot" style={{ width: 6, height: 6 }} />
                  B20 Spotlight · top volume
                </span>
                <h2 className="font-display text-2xl sm:text-4xl font-bold text-white tracking-tight truncate">
                  {spotlight.token.name}
                </h2>
                <p className="text-[15px] sm:text-lg text-[#6BA3FF] font-mono font-semibold mt-1">
                  ${spotlight.token.symbol}
                </p>
                {spotlight.market?.priceUsd != null && (
                  <p className="text-[14px] text-[var(--ink-muted)] mt-2 font-mono">
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

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4 shrink-0 w-full lg:w-auto">
              {[
                {
                  label: "Vol 24h",
                  value: spotlight.market?.volume24h ? formatUsd(spotlight.market.volume24h) : "—",
                },
                {
                  label: "Liquidity",
                  value: spotlight.market?.liquidityUsd ? formatUsd(spotlight.market.liquidityUsd) : "—",
                },
                {
                  label: "MCap",
                  value: spotlight.market?.marketCap ? formatUsd(spotlight.market.marketCap) : "—",
                },
                { label: "Pool", value: spotlight.market?.hasPool ? "Live" : "—" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-black/35 border border-white/10 px-3 py-3 sm:px-4 sm:py-3.5"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">
                    {stat.label}
                  </p>
                  <p className="text-[15px] sm:text-base font-bold text-white font-mono mt-1 tabular-nums">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 lg:flex-col lg:items-end shrink-0">
              <span className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#080808] text-[14px] font-bold group-hover:bg-[#6BA3FF] transition-colors">
                Trade in-app
                <ArrowUpRight size={16} />
              </span>
              <span className="text-[11px] text-[var(--ink-dim)] hidden sm:block">
                Uniswap + Aerodrome · USD quotes
              </span>
            </div>
          </div>
        </button>
      )}

      <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-end">
        <div>
          <p className="section-eyebrow mb-2 sm:mb-3">Explore Base</p>
          <h1 className="page-hero-title max-w-2xl">
            Discover tokens.
            <br />
            <span className="text-[#6BA3FF]">Swap without leaving.</span>
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
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--ink)] text-[#080808] text-[14px] font-bold hover:bg-white transition-colors touch-manipulation"
                >
                  <TrendingUp size={16} />
                  Browse trending
                </button>
                <button
                  type="button"
                  onClick={onConnectToTrade ?? onConnect}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl border border-[#0052FF]/40 bg-[#0052FF]/15 text-[14px] font-bold text-[#6BA3FF] hover:bg-[#0052FF]/25 transition-colors touch-manipulation"
                >
                  <Wallet size={16} />
                  Connect to trade
                </button>
                <button
                  type="button"
                  onClick={onLaunch}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-white/[0.12] text-[14px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors touch-manipulation"
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
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--ink)] text-[#080808] text-[14px] font-bold hover:bg-white transition-colors touch-manipulation"
                >
                  <TrendingUp size={16} />
                  Browse trending
                </button>
                <button
                  type="button"
                  onClick={onLaunch}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl border border-[#0052FF]/40 bg-[#0052FF]/15 text-[14px] font-bold text-[#6BA3FF] hover:bg-[#0052FF]/25 transition-colors touch-manipulation"
                >
                  <Plus size={16} />
                  Launch B20 token
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-white/[0.12] text-[14px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[#0052FF]/40 transition-colors touch-manipulation"
            >
              <Command size={15} />
              Search
              <kbd className="hidden sm:inline text-[10px] font-mono text-[var(--ink-dim)] border border-white/10 rounded px-1.5 py-0.5">
                ⌘K
              </kbd>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
