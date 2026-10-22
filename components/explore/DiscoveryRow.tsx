"use client";

import React from "react";
import { ArrowRight, Rocket } from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import TokenCard from "./TokenCard";
import { EXPLORE_CONFIG } from "@/lib/explore/explore-config";

interface DiscoveryRowProps {
  title: string;
  description: string;
  tokens: UnifiedToken[];
  onViewAll?: () => void;
  onTrade: (token: UnifiedToken) => void;
  onSelect?: (token: UnifiedToken) => void;
  onToggleWatch?: (token: UnifiedToken) => void;
  watchlist?: string[];
  showLiquidityToggle?: boolean;
  hideLowLiquidity?: boolean;
  onToggleLowLiquidity?: () => void;
  onLaunch?: () => void;
  emptyLabel?: string;
}

export default function DiscoveryRow({
  title,
  description,
  tokens,
  onViewAll,
  onTrade,
  onSelect,
  onToggleWatch,
  watchlist = [],
  showLiquidityToggle = false,
  hideLowLiquidity = true,
  onToggleLowLiquidity,
  onLaunch,
  emptyLabel = "No tokens found in this section yet.",
}: DiscoveryRowProps) {
  const displayTokens = tokens.slice(0, EXPLORE_CONFIG.DISCOVERY_ROW_MAX_ITEMS);

  return (
    <section className="space-y-3.5">
      {/* Row Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-lg font-black text-[var(--ink)] tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">{description}</p>
        </div>

        {/* Action Controls: Liquidity Toggle + View All */}
        <div className="flex items-center gap-3 self-start sm:self-center">
          {showLiquidityToggle && onToggleLowLiquidity && (
            <label className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideLowLiquidity}
                onChange={onToggleLowLiquidity}
                className="rounded border-[var(--border-subtle)] text-[var(--brand)] accent-[var(--brand)] focus:ring-0 cursor-pointer"
              />
              <span>Hide &lt; $10K liq</span>
            </label>
          )}

          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="pop-pill text-xs font-bold text-[var(--brand-text)] px-2.5 py-1 rounded-full border border-[var(--brand)]/20 bg-[var(--brand-soft)] flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>View all</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Row Content */}
      {displayTokens.length === 0 ? (
        /* Slim inline empty banner */
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs">
          <span className="text-[var(--ink-muted)]">{emptyLabel}</span>
          {onLaunch && (
            <button
              type="button"
              onClick={onLaunch}
              className="btn-primary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Rocket size={13} />
              <span>Launch</span>
            </button>
          )}
        </div>
      ) : (
        /* Horizontal snap-scroll on mobile, responsive grid on desktop */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 max-sm:flex max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory max-sm:py-3 max-sm:-my-3 max-sm:px-1 max-sm:-mx-1 no-scrollbar">
          {displayTokens.map((token) => (
            <div key={token.id} className="max-sm:min-w-[280px] max-sm:snap-start">
              <TokenCard
                token={token}
                onTrade={onTrade}
                onSelect={onSelect}
                onToggleWatch={onToggleWatch}
                isWatched={watchlist.includes(token.address.toLowerCase())}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
