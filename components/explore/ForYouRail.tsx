"use client";

import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";

function ForYouCard({
  token,
  market,
  onOpen,
}: {
  token: LaunchedToken;
  market?: TokenMarketSummary;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="shrink-0 snap-start w-[188px] sm:w-[200px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-left hover:border-[var(--border-strong)] transition-colors"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)] mb-2">
        For you
      </p>
      <p className="text-[13px] font-semibold text-white truncate">{token.name}</p>
      <p className="text-[11px] text-[var(--ink-muted)] font-mono">${token.symbol}</p>
      {market?.volume24h != null && market.volume24h > 0 && (
        <p className="text-[10px] text-slate-500 mt-2 font-mono">
          Vol ${market.volume24h >= 1000 ? `${(market.volume24h / 1000).toFixed(0)}K` : market.volume24h.toFixed(0)}
        </p>
      )}
    </button>
  );
}

export default function ForYouRail({
  tokens,
  markets,
  onOpen,
}: {
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
  onOpen: (t: LaunchedToken) => void;
}) {
  if (!tokens.length) return null;

  return (
    <section>
      <div className="mb-4">
        <p className="section-eyebrow mb-1">Personalized</p>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] tracking-tight">
          For you
        </h2>
        <p className="readable-body text-xs mt-1">
          Based on your swap history and activity on Base.
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 px-1 no-scrollbar touch-scroll-x snap-x snap-mandatory">
        {tokens.map((t) => (
          <ForYouCard
            key={`foryou-${t.address}`}
            token={t}
            market={markets[t.address.toLowerCase()]}
            onOpen={() => onOpen(t)}
          />
        ))}
      </div>
    </section>
  );
}
