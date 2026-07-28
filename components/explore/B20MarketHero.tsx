"use client";

import { useMemo } from "react";
import { ArrowUpRight, Plus, TrendingDown, TrendingUp } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { formatSubscriptPrice, formatUsd } from "@/lib/launchpad/format";
import { buildFeaturedB20Tokens } from "@/lib/launchpad/b20-gainers";
import { isAppLaunched, tokenBadgeLabel } from "@/lib/launchpad/token-meta";
import TokenCard, { CreateTokenCard } from "@/components/launchpad/TokenCard";

export default function B20MarketHero({
  tokens,
  markets,
  onOpen,
  onLaunch,
  loading,
  guestMode,
}: {
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
  onOpen: (token: LaunchedToken) => void;
  onLaunch?: () => void;
  loading?: boolean;
  guestMode?: boolean;
}) {
  const featured = useMemo(
    () => buildFeaturedB20Tokens(tokens, markets, 11),
    [tokens, markets]
  );

  const spotlight = featured[0];
  const grid = featured.slice(1);

  const b20Stats = useMemo(() => {
    let volume = 0;
    let liquidity = 0;
    for (const t of tokens) {
      const m = markets[t.address.toLowerCase()];
      volume += m?.volume24h ?? 0;
      liquidity += m?.liquidityUsd ?? 0;
    }
    return { count: tokens.length, volume, liquidity };
  }, [tokens, markets]);

  if (!loading && featured.length === 0) return null;

  const spotlightMarket = spotlight
    ? markets[spotlight.address.toLowerCase()]
    : undefined;
  const spotlightPriceUsd = spotlightMarket?.priceUsd;
  const spotlightVolume24h = spotlightMarket?.volume24h;
  const spotlightMarketCap = spotlightMarket?.marketCap;
  const spotlightFdv = spotlightMarket?.fdv;
  const spotlightCap = spotlightMarketCap ?? spotlightFdv;
  const spotlightChange24h = spotlightMarket?.priceChange24h;
  const chg = spotlightChange24h ?? 0;
  const isUp = chg >= 0;

  return (
    <section className="b20-market-hero">
      <div className="b20-market-hero-glow" aria-hidden />

      <div className="relative z-[1] space-y-6 sm:space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="b20-market-eyebrow">Main market · Base</p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-[var(--ink)] tracking-tight leading-[1.05]">
              B20 tokens
            </h2>
            <p className="text-sm sm:text-[15px] text-[var(--ink-muted)] mt-2 max-w-2xl leading-relaxed">
              Vanity 0xB200… addresses with live liquidity on Aerodrome and Uniswap —
              trade, launch, and track the B20 ecosystem on Base.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <div className="b20-market-stat">
              <span className="b20-market-stat-label">B20 live</span>
              <span className="b20-market-stat-value">{loading ? "…" : b20Stats.count}</span>
            </div>
            {b20Stats.volume > 0 && (
              <div className="b20-market-stat">
                <span className="b20-market-stat-label">24h volume</span>
                <span className="b20-market-stat-value">{formatUsd(b20Stats.volume)}</span>
              </div>
            )}
            {b20Stats.liquidity > 0 && (
              <div className="b20-market-stat">
                <span className="b20-market-stat-label">Pool liquidity</span>
                <span className="b20-market-stat-value">{formatUsd(b20Stats.liquidity)}</span>
              </div>
            )}
          </div>
        </header>

        {loading ? (
          <div className="space-y-4">
            <div className="h-44 sm:h-52 rounded-2xl bg-[var(--bg-raised)] animate-pulse border border-white/[0.08]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-52 rounded-xl bg-[var(--bg-raised)] animate-pulse border border-white/[0.06]"
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {spotlight && (
              <button
                type="button"
                onClick={() => onOpen(spotlight)}
                className="b20-market-spotlight group w-full text-left"
                aria-label={`Open ${spotlight.name} — top B20`}
              >
                <div className="b20-market-spotlight-accent" aria-hidden />
                <div className="b20-market-spotlight-body">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
                    <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
                      {spotlight.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={spotlight.imageUrl}
                          alt=""
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-[var(--border-strong)] shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] flex items-center justify-center text-xl font-black text-[var(--ink-muted)] shrink-0">
                          {spotlight.symbol.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="b20-market-eyebrow inline-flex !text-[10px]">
                            #1 B20 · Spotlight
                          </span>
                          {isAppLaunched(spotlight) && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                              App launch
                            </span>
                          )}
                        </div>
                        <h3 className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] truncate group-hover:text-[var(--brand-dark)] transition-colors">
                          {spotlight.name}
                        </h3>
                        <p className="text-base text-[var(--ink-muted)] font-mono mt-1">
                          ${spotlight.symbol}
                        </p>
                        <p className="text-[12px] text-[var(--ink-dim)] mt-2">
                          {tokenBadgeLabel(spotlight)} · Top volume on Base
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:min-w-[22rem] shrink-0">
                      {spotlightPriceUsd != null && spotlightPriceUsd > 0 && (
                        <div className="spotlight-stat">
                          <p className="spotlight-stat-label">Price</p>
                          <p className="spotlight-stat-value">
                            {formatSubscriptPrice(spotlightPriceUsd)}
                          </p>
                        </div>
                      )}
                      {spotlightVolume24h != null && spotlightVolume24h > 0 && (
                        <div className="spotlight-stat">
                          <p className="spotlight-stat-label">24h vol</p>
                          <p className="spotlight-stat-value">
                            {formatUsd(spotlightVolume24h)}
                          </p>
                        </div>
                      )}
                      {spotlightCap != null && (
                        <div className="spotlight-stat">
                          <p className="spotlight-stat-label">
                            {spotlightMarketCap != null ? "Market cap" : "FDV"}
                          </p>
                          <p className="spotlight-stat-value text-emerald-700">
                            {formatUsd(spotlightCap)}
                          </p>
                        </div>
                      )}
                      {spotlightChange24h != null && (
                        <div className="spotlight-stat">
                          <p className="spotlight-stat-label">24h</p>
                          <p
                            className={`spotlight-stat-value inline-flex items-center gap-1 ${
                              isUp ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {isUp ? "+" : ""}
                            {chg.toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>

                    <span className="hidden lg:inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] shrink-0 group-hover:gap-3 transition-all">
                      Trade
                      <ArrowUpRight size={18} />
                    </span>
                  </div>
                </div>
              </button>
            )}

            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-display text-lg sm:text-xl font-bold text-[var(--ink)] tracking-tight">
                  Trending &amp; movers
                </h3>
                {!guestMode && onLaunch && (
                  <button
                    type="button"
                    onClick={onLaunch}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--brand-dark)] hover:text-[var(--brand)] transition-colors"
                  >
                    <Plus size={14} />
                    Launch B20
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {!guestMode && onLaunch && <CreateTokenCard onCreate={onLaunch} />}
                {grid.map((t) => (
                  <TokenCard
                    key={t.address}
                    token={t}
                    market={markets[t.address.toLowerCase()]}
                    onTrade={() => onOpen(t)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
