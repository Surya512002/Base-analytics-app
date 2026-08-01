"use client";

import { useMemo } from "react";
import { Rocket, Sparkles } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { buildRecentlyAppLaunched } from "@/lib/launchpad/explore-rankings";
import TokenCard, { CreateTokenCard } from "@/components/launchpad/TokenCard";

export default function RecentlyLaunchedSection({
  tokens,
  markets,
  onOpen,
  onLaunch,
  syncing = false,
  guestMode = false,
}: {
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
  onOpen: (token: LaunchedToken) => void;
  onLaunch?: () => void;
  syncing?: boolean;
  guestMode?: boolean;
}) {
  const recent = useMemo(
    () => buildRecentlyAppLaunched(tokens, 8),
    [tokens]
  );

  if (recent.length === 0) {
    if (syncing) {
      return (
        <div className="rounded-xl border border-white/[0.08] bg-[var(--bg-raised)]/40 h-40 animate-pulse" />
      );
    }
    return (
      <section className="space-y-4">
        <div>
          <p className="section-eyebrow mb-1 inline-flex items-center gap-1.5 text-[var(--accent)]">
            <Rocket size={12} />
            Our launchpad
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] tracking-tight">
            Recently launched
          </h2>
          <p className="text-[12px] text-[var(--ink-dim)] mt-1 max-w-xl">
            Tokens created on this platform show up here first — newest launches only.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {onLaunch && !guestMode ? (
            <CreateTokenCard onCreate={onLaunch} />
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface)]/60 px-4 py-8 text-center sm:col-span-2">
              <Sparkles size={18} className="mx-auto text-[var(--ink-dim)] mb-2" />
              <p className="text-sm font-bold text-[var(--ink)]">No platform launches yet</p>
              <p className="text-[12px] text-[var(--ink-dim)] mt-1">
                Be the first to launch a B20 token here.
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="section-eyebrow mb-1 inline-flex items-center gap-1.5 text-[var(--accent)]">
            <Rocket size={12} />
            Our launchpad
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--ink)] tracking-tight">
            Recently launched
          </h2>
          <p className="text-[12px] text-[var(--ink-dim)] mt-1 max-w-xl">
            Newest tokens launched on this platform — not DexScreener or factory-only listings.
          </p>
        </div>
        <span className="text-[11px] text-[var(--ink-dim)] font-mono shrink-0">
          {recent.length} new
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {recent.map((t) => (
          <TokenCard
            key={t.address}
            token={t}
            market={markets[t.address.toLowerCase()]}
            onTrade={() => onOpen(t)}
          />
        ))}
        {onLaunch && !guestMode && recent.length < 8 ? (
          <CreateTokenCard onCreate={onLaunch} />
        ) : null}
      </div>
    </section>
  );
}
