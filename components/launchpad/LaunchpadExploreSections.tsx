"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { buildBaseTopMovers } from "@/lib/launchpad/explore-rankings";
import TokenCard from "@/components/launchpad/TokenCard";

export default function LaunchpadExploreSections({
  tokens,
  markets,
  onOpen,
  syncing = false,
}: {
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
  onOpen: (token: LaunchedToken) => void;
  syncing?: boolean;
}) {
  const movers = useMemo(
    () => buildBaseTopMovers(tokens, markets, 12),
    [tokens, markets]
  );

  if (movers.length === 0) {
    if (syncing) {
      return (
        <div className="rounded-xl border border-white/[0.08] bg-[var(--bg-raised)]/40 h-40 animate-pulse" />
      );
    }
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="section-eyebrow mb-1 inline-flex items-center gap-1.5 text-emerald-300/90">
            <TrendingUp size={12} />
            24h gainers · Base network
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] tracking-tight">
            Top movers
          </h2>
          <p className="text-[12px] text-[var(--ink-dim)] mt-1 max-w-xl">
            B20 and ecosystem tokens with the strongest 24h price moves and live liquidity.
          </p>
        </div>
        <span className="text-[11px] text-[var(--ink-dim)] font-mono shrink-0">
          {movers.length} live
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {movers.map((t) => (
          <TokenCard
            key={t.address}
            token={t}
            market={markets[t.address.toLowerCase()]}
            onTrade={() => onOpen(t)}
          />
        ))}
      </div>
    </section>
  );
}
