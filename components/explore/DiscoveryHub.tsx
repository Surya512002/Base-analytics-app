"use client";

import React, { useState } from "react";
import { Flame, TrendingUp, Sparkles, Landmark, ArrowRight, Rocket } from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import TokenCard from "./TokenCard";
import { EXPLORE_CONFIG } from "@/lib/explore/explore-config";

export type DiscoveryTab = "trending" | "gainers" | "new" | "stocks";

interface DiscoveryHubProps {
  trendingTokens: UnifiedToken[];
  topMoversTokens: UnifiedToken[];
  recentlyLaunchedTokens: UnifiedToken[];
  stockTokens: UnifiedToken[];
  onTrade: (token: UnifiedToken) => void;
  onSelect?: (token: UnifiedToken) => void;
  onToggleWatch?: (token: UnifiedToken) => void;
  watchlist?: string[];
  moversHideLowLiquidity: boolean;
  onToggleLowLiquidity: () => void;
  onLaunch?: () => void;
  onViewAllCategory: (category: DiscoveryTab) => void;
}

export default function DiscoveryHub({
  trendingTokens,
  topMoversTokens,
  recentlyLaunchedTokens,
  stockTokens,
  onTrade,
  onSelect,
  onToggleWatch,
  watchlist = [],
  moversHideLowLiquidity,
  onToggleLowLiquidity,
  onLaunch,
  onViewAllCategory,
}: DiscoveryHubProps) {
  const [activeTab, setActiveTab] = useState<DiscoveryTab>("trending");

  const tabConfig = {
    trending: {
      title: "Trending on Base",
      description: "Highest 24h trading volume and community DEX activity.",
      tokens: trendingTokens,
      icon: <Flame size={14} className="text-amber-500" />,
      badge: `${trendingTokens.length} active`,
    },
    gainers: {
      title: "Top Gainers & Movers",
      description: "Largest upward price momentum over the last 24 hours.",
      tokens: topMoversTokens,
      icon: <TrendingUp size={14} className="text-emerald-500" />,
      badge: `${topMoversTokens.length} movers`,
    },
    new: {
      title: "Recently Launched",
      description: "Latest tokens deployed on Base mainnet with liquidity lockers.",
      tokens: recentlyLaunchedTokens,
      icon: <Sparkles size={14} className="text-purple-500" />,
      badge: `${recentlyLaunchedTokens.length} tokens`,
    },
    stocks: {
      title: "Tokenized US Stocks",
      description: "Coinbase B20 equities backed 1:1 by custodial shares on Base.",
      tokens: stockTokens,
      icon: <Landmark size={14} className="text-[#0052FF]" />,
      badge: `${stockTokens.length} stocks`,
    },
  };

  const current = tabConfig[activeTab];
  const displayTokens = current.tokens.slice(0, EXPLORE_CONFIG.DISCOVERY_ROW_MAX_ITEMS);

  return (
    <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-6 shadow-xs space-y-4 transition-all">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER & SEGMENTED TABS
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]/70">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-[var(--ink)] tracking-tight">
              {current.title}
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
              {current.badge}
            </span>
          </div>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">
            {current.description}
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] gap-1 self-start md:self-auto overflow-x-auto max-w-full no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("trending")}
            className={`pop-pill px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "trending"
                ? "bg-[#0052FF] text-white shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Flame size={13} className={activeTab === "trending" ? "text-amber-300" : "text-amber-500"} />
            <span>Trending</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("gainers")}
            className={`pop-pill px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "gainers"
                ? "bg-[#0052FF] text-white shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <TrendingUp size={13} className={activeTab === "gainers" ? "text-emerald-300" : "text-emerald-500"} />
            <span>Top Gainers</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`pop-pill px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "new"
                ? "bg-[#0052FF] text-white shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Sparkles size={13} className={activeTab === "new" ? "text-purple-300" : "text-purple-400"} />
            <span>New Launches</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("stocks")}
            className={`pop-pill px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "stocks"
                ? "bg-[#0052FF] text-white shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Landmark size={13} className={activeTab === "stocks" ? "text-white" : "text-[#0052FF]"} />
            <span>Stocks</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. ACTION STRIP (Liquidity Filter Toggle + View All in Explorer)
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs pt-0.5">
        <div>
          {activeTab === "gainers" && (
            <label className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={moversHideLowLiquidity}
                onChange={onToggleLowLiquidity}
                className="rounded border-[var(--border-subtle)] text-[#0052FF] accent-[#0052FF] focus:ring-0 cursor-pointer"
              />
              <span>Hide &lt; $10K liquidity</span>
            </label>
          )}
        </div>

        <button
          type="button"
          onClick={() => onViewAllCategory(activeTab)}
          className="pop-pill text-xs font-bold text-[var(--brand-text)] px-3 py-1 rounded-xl border border-[var(--brand)]/20 bg-[var(--brand-soft)] flex items-center gap-1 cursor-pointer transition hover:border-[var(--brand)] ml-auto"
        >
          <span>View all {activeTab} in Explorer</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TOKEN CARDS GRID (Clean, responsive, Base Market layout)
          ───────────────────────────────────────────────────────────── */}
      {displayTokens.length === 0 ? (
        <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 text-xs">
          <span className="text-[var(--ink-muted)]">No tokens found in this section yet.</span>
          {activeTab === "new" && onLaunch && (
            <button
              type="button"
              onClick={onLaunch}
              className="px-3 py-1.5 rounded-xl bg-[#0052FF] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer hover:opacity-95"
            >
              <Rocket size={13} />
              <span>Launch First Token</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 max-sm:flex max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory max-sm:py-2 max-sm:-my-2 max-sm:px-1 max-sm:-mx-1 no-scrollbar">
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
