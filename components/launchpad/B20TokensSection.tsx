"use client";

import { useMemo } from "react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { isAppLaunched } from "@/lib/launchpad/token-meta";
import { sortByMarketVolume } from "@/lib/launchpad/merge-tokens";
import { buildB20GainersRail } from "@/lib/launchpad/b20-gainers";
import TokenCard, { CreateTokenCard } from "@/components/launchpad/TokenCard";

type B20Filter = "all" | "trending" | "newest" | "gainers" | "volume" | "mine" | "watchlist";

export default function B20TokensSection({
  tokens,
  allTokens,
  markets,
  loading,
  filter,
  onFilterChange,
  onOpen,
  onTrade,
  onCreate,
  guestMode,
  wallet,
  watchlist,
  onToggleWatch,
}: {
  tokens: LaunchedToken[];
  /** Full B20 index — used for Mine so creators see unseeded launches. */
  allTokens?: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
  loading?: boolean;
  filter: B20Filter;
  onFilterChange: (f: B20Filter) => void;
  onOpen: (token: LaunchedToken) => void;
  onTrade?: (token: LaunchedToken) => void;
  onCreate: () => void;
  guestMode?: boolean;
  wallet?: string;
  watchlist: string[];
  onToggleWatch: (address: string) => void;
}) {
  const filtered = useMemo(() => {
    const base =
      filter === "mine" && wallet ? (allTokens ?? tokens) : tokens;
    let list = [...base];

    if (filter === "newest") {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (filter === "trending" || filter === "volume") {
      list = sortByMarketVolume(
        list.filter((t) => (markets[t.address.toLowerCase()]?.volume24h ?? 0) > 0),
        markets
      );
    } else if (filter === "gainers") {
      list = buildB20GainersRail(
        list,
        markets,
        sortByMarketVolume(
          list.filter((t) => (markets[t.address.toLowerCase()]?.volume24h ?? 0) > 0),
          markets
        ),
        48,
        { excludeTrending: false }
      );
    } else if (filter === "watchlist") {
      const pool = allTokens ?? tokens;
      list = watchlist
        .map((addr) => pool.find((t) => t.address.toLowerCase() === addr))
        .filter((t): t is LaunchedToken => Boolean(t));
    } else if (filter === "mine" && wallet) {
      const w = wallet.toLowerCase();
      list = list.filter((t) => t.creator.toLowerCase() === w);
    } else {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    return list;
  }, [tokens, allTokens, filter, markets, watchlist, wallet]);

  const tabs: { id: B20Filter; label: string }[] = [
    { id: "all", label: "All B20" },
    { id: "trending", label: "Trending" },
    { id: "newest", label: "New" },
    { id: "gainers", label: "Top gainers" },
    { id: "volume", label: "Volume" },
    { id: "watchlist", label: "Watching" },
    { id: "mine", label: "Mine" },
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--base-blue)]/20 bg-[var(--base-blue)]/[0.03] p-4 sm:p-5">
      <div>
        <p className="section-eyebrow mb-1 text-[#7aa2ff]">B20 on Base</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-[var(--ink)] tracking-tight">
            B20 tokens
          </h2>
          <span className="text-[11px] text-[var(--ink-dim)] font-mono">
            {tokens.length} indexed
          </span>
        </div>
        <p className="text-[12px] text-[var(--ink-dim)] mt-1.5 max-w-2xl">
          Vanity 0xB200… addresses from the B20 factory, GeckoTerminal trending, and DexScreener.
        </p>
      </div>

      <div className="flex gap-x-3 sm:gap-x-4 gap-y-1 overflow-x-auto no-scrollbar touch-scroll-x border-b border-[var(--base-blue)]/15 -mx-1 px-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onFilterChange(id)}
            className={`filter-tab shrink-0 min-h-[40px] touch-manipulation ${filter === id ? "filter-tab-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-52 rounded-xl bg-[var(--bg-raised)] animate-pulse border border-white/[0.06]"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {!guestMode && <CreateTokenCard onCreate={onCreate} />}
          {filtered.map((t) => (
            <TokenCard
              key={t.address}
              token={t}
              market={markets[t.address.toLowerCase()]}
              onOpen={() => onOpen(t)}
              onTrade={() => (onTrade ?? onOpen)(t)}
              isMine={
                (isAppLaunched(t) || Boolean(t.creator)) &&
                wallet?.toLowerCase() === t.creator.toLowerCase()
              }
              watched={watchlist.includes(t.address.toLowerCase())}
              onToggleWatch={() => onToggleWatch(t.address)}
            />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-sm text-[var(--ink-dim)] py-8">
          {filter === "mine"
            ? "You haven’t launched a B20 token yet."
            : filter === "watchlist"
              ? "No B20 tokens on your watchlist."
              : "No B20 tokens match this filter yet."}
        </p>
      )}
    </section>
  );
}
