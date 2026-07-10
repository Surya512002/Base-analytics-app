"use client";

import { useMemo } from "react";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { createdAgo, formatUsd } from "@/lib/launchpad/format";
import {
  isAppLaunched,
  isB20ExploreToken,
  isRecentB20,
  tokenSource,
} from "@/lib/launchpad/token-meta";
import { isTradableListing } from "@/lib/launchpad/tradable";
import { sortByMarketVolume } from "@/lib/launchpad/merge-tokens";
import { buildB20GainersRail } from "@/lib/launchpad/b20-gainers";
import type { GlobalActivityItem } from "@/lib/api/launchpad-market-client";
import { buildHotTokens } from "@/lib/launchpad/explore-rankings";

function TokenRailCard({
  token,
  onOpen,
  badge,
  market,
  stat,
}: {
  token: LaunchedToken;
  onOpen: () => void;
  badge?: string;
  market?: TokenMarketSummary;
  stat?: "change" | "volume";
}) {
  const when =
    token.createdAt > 0
      ? createdAgo(token.createdAt)
      : tokenSource(token) === "external"
        ? "DexScreener"
        : "New";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group shrink-0 snap-start w-[188px] sm:w-[200px] rounded-xl border border-white/[0.08] bg-[var(--bg-raised)] p-3.5 text-left hover:border-white/20 transition-colors"
    >
      <div className="flex items-center gap-2.5 mb-3">
        {token.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={token.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-[11px] font-semibold text-[var(--ink)]">
            {token.symbol.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--ink)] truncate group-hover:opacity-90">
            {token.name}
          </p>
          <p className="text-[11px] text-[var(--ink-muted)] font-mono">${token.symbol}</p>
        </div>
      </div>
      {badge && (
        <span className="inline-block text-[9px] font-semibold uppercase tracking-wider text-[var(--ink-dim)] mb-2">
          {badge}
        </span>
      )}
      <div className="flex items-center justify-between text-[10px] text-[var(--ink-dim)]">
        <span>{when}</span>
        {stat === "change" && market?.priceChange24h != null ? (
          <span
            className={`inline-flex items-center gap-0.5 font-mono font-medium ${
              market.priceChange24h >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {market.priceChange24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {market.priceChange24h >= 0 ? "+" : ""}
            {market.priceChange24h.toFixed(1)}%
          </span>
        ) : stat === "volume" && market?.volume24h != null && market.volume24h > 0 ? (
          <span className="font-mono text-[var(--ink-muted)]">
            Vol {formatUsd(market.volume24h)}
          </span>
        ) : (
          <ArrowUpRight
            size={12}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--ink)]"
          />
        )}
      </div>
      <div className="mt-2">
        {market?.marketCap ? (
          <span className="text-[10px] font-bold text-emerald-300/90">
            MC {formatUsd(market.marketCap)}
          </span>
        ) : market?.fdv ? (
          <span className="text-[10px] font-bold text-emerald-300/90">
            FDV {formatUsd(market.fdv)}
          </span>
        ) : market?.liquidityUsd && market.liquidityUsd > 0 ? (
          <span className="text-[10px] font-bold text-[var(--ink-dim)]">
            Liq {formatUsd(market.liquidityUsd)}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export default function LaunchpadExploreSections({
  tokens,
  markets,
  onOpen,
  activities = [],
  syncing = false,
}: {
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
  onOpen: (token: LaunchedToken) => void;
  activities?: GlobalActivityItem[];
  syncing?: boolean;
}) {
  const tradable = useMemo(
    () => tokens.filter((t) => isTradableListing(t, markets)),
    [tokens, markets]
  );

  const justLaunched = useMemo(() => {
    const recent = tradable
      .filter((t) => isAppLaunched(t) || isRecentB20(t))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return recent.slice(0, 16);
  }, [tradable]);

  const trending = useMemo(
    () =>
      sortByMarketVolume(
        tradable.filter((t) => (markets[t.address.toLowerCase()]?.volume24h ?? 0) > 0),
        markets
      ).slice(0, 8),
    [tradable, markets]
  );

  const b20Tokens = useMemo(() => tradable.filter(isB20ExploreToken), [tradable]);

  const b20Trending = useMemo(
    () =>
      sortByMarketVolume(
        b20Tokens.filter((t) => (markets[t.address.toLowerCase()]?.volume24h ?? 0) > 0),
        markets
      ).slice(0, 10),
    [b20Tokens, markets]
  );

  const b20Gainers = useMemo(
    () => buildB20GainersRail(b20Tokens, markets, b20Trending, 10),
    [b20Tokens, markets, b20Trending]
  );

  const hotNow = useMemo(
    () => buildHotTokens(activities, tradable, markets, 8),
    [activities, tradable, markets]
  );

  if (tradable.length === 0) {
    if (syncing) {
      return (
        <div className="rounded-xl border border-white/[0.08] bg-[var(--bg-raised)]/40 h-28 animate-pulse" />
      );
    }
    return null;
  }

  return (
    <div className="space-y-8">
      {hotNow.length > 0 && (
        <section>
          <div className="mb-4">
            <p className="section-eyebrow mb-1 text-rose-300/90">Hot right now</p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] tracking-tight">
              Last hour activity
            </h2>
            <p className="text-[12px] text-[var(--ink-dim)] mt-1">
              Tokens with the most recent swaps and launches — updated live.
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 px-1 no-scrollbar touch-scroll-x snap-x snap-mandatory">
            {hotNow.map((t) => (
              <TokenRailCard
                key={`hot-${t.address}`}
                token={t}
                market={markets[t.address.toLowerCase()]}
                onOpen={() => onOpen(t)}
                badge="Hot"
                stat="volume"
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4">
          <p className="section-eyebrow mb-1">Trending 24h</p>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] tracking-tight">
            Tokens &amp; liquidity
          </h2>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar touch-scroll-x">
          {(trending.length > 0 ? trending : justLaunched.slice(0, 6)).map((t) => (
            <TokenRailCard
              key={`trend-${t.address}`}
              token={t}
              onOpen={() => onOpen(t)}
              badge={
                isAppLaunched(t) ? "App launch" : isRecentB20(t) ? "B20" : "Trending"
              }
            />
          ))}
        </div>
      </section>

      {(b20Trending.length > 0 || b20Gainers.length > 0) && (
        <section className="rounded-2xl border border-[var(--base-blue)]/20 bg-[var(--base-blue)]/[0.04] p-4 sm:p-5 space-y-6">
          <div>
            <p className="section-eyebrow mb-1 text-[#7aa2ff]">B20 on Base</p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] tracking-tight">
              B20 market rails
            </h2>
            <p className="text-[12px] text-[var(--ink-dim)] mt-1.5 max-w-xl">
              Trending and top gainers among B20 vanity tokens — factory launches and app
              deployments on Base.
            </p>
          </div>

          {b20Trending.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg font-bold text-[var(--ink)] tracking-tight">
                  Trending B20
                </h3>
                <span className="text-[11px] text-[var(--ink-dim)] font-mono">
                  by 24h volume
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 px-1 no-scrollbar touch-scroll-x snap-x snap-mandatory">
                {b20Trending.map((t) => (
                  <TokenRailCard
                    key={`b20-trend-${t.address}`}
                    token={t}
                    market={markets[t.address.toLowerCase()]}
                    onOpen={() => onOpen(t)}
                    badge={isAppLaunched(t) ? "App · B20" : "B20"}
                    stat="volume"
                  />
                ))}
              </div>
            </div>
          )}

          {b20Gainers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg font-bold text-[var(--ink)] tracking-tight">
                  Top gainers · B20
                </h3>
                <span className="text-[11px] text-[var(--ink-dim)] font-mono">
                  24h price change · top movers
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 px-1 no-scrollbar touch-scroll-x snap-x snap-mandatory">
                {b20Gainers.map((t) => {
                  const market = markets[t.address.toLowerCase()];
                  return (
                    <TokenRailCard
                      key={`b20-gain-${t.address}`}
                      token={t}
                      market={market}
                      onOpen={() => onOpen(t)}
                      badge={isAppLaunched(t) ? "App · B20" : "B20"}
                      stat="change"
                    />
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {justLaunched.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-bold text-[var(--ink)] tracking-tight">
              Just launched
            </h3>
            <span className="text-[11px] text-[var(--ink-dim)] font-mono">
              {justLaunched.length} recent
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 px-1 no-scrollbar touch-scroll-x snap-x snap-mandatory">
            {justLaunched.map((t) => (
              <TokenRailCard
                key={`new-${t.address}`}
                token={t}
                onOpen={() => onOpen(t)}
                badge={isAppLaunched(t) ? "App · B20" : "B20"}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
