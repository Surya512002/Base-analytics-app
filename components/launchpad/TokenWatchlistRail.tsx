"use client";

import { Star } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import TokenCard from "@/components/launchpad/TokenCard";

export default function TokenWatchlistRail({
  tokens,
  markets,
  watchlist,
  onOpen,
  onToggleWatch,
  pinned,
  holdings,
}: {
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
  watchlist: string[];
  onOpen: (t: LaunchedToken) => void;
  onToggleWatch: (address: string) => void;
  pinned?: boolean;
  holdings?: Record<string, number>;
}) {
  const watched = tokens.filter((t) => watchlist.includes(t.address.toLowerCase()));
  if (watched.length === 0) return null;

  return (
    <section
      className={
        pinned
          ? "rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4 sm:p-5"
          : undefined
      }
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <Star size={16} className="text-amber-400 fill-amber-400" />
        <h3 className="text-sm font-black text-[var(--ink)]">
          {pinned ? "Pinned watchlist" : "Your watchlist"}
        </h3>
        <span className="text-[10px] text-[var(--ink-dim)]">{watched.length}</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {watched.map((t) => (
          <TokenCard
            key={t.address}
            token={t}
            market={markets[t.address.toLowerCase()]}
            onTrade={() => onOpen(t)}
            watched
            onToggleWatch={() => onToggleWatch(t.address)}
            holdingBalance={holdings?.[t.address.toLowerCase()]}
          />
        ))}
      </div>
    </section>
  );
}
