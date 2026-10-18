"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import type { UnifiedToken, ExploreFiltersState } from "@/lib/explore/explore-types";
import {
  EXPLORE_CONFIG,
  normalizeLaunchedToken,
  normalizeBaseStock,
} from "@/lib/explore/explore-config";
import { BASE_STOCKS } from "@/lib/stocks/base-stocks";
import { isB20ExploreToken } from "@/lib/launchpad/token-meta";
import ExploreHero from "./ExploreHero";
import DiscoveryRow from "./DiscoveryRow";
import FilterBar from "./FilterBar";
import TokenTable from "./TokenTable";
import TokenQuickView from "./TokenQuickView";
import CommandPalette from "@/components/shell/CommandPalette";
import {
  readTokenWatchlist,
  toggleTokenWatch,
} from "@/lib/utils/token-watchlist";
import { useTokenHoldings } from "@/hooks/useTokenHoldings";

interface ExploreHubProps {
  app: WalletAppState;
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
  marketStats: { totalVolume24h: number; totalLiquidity: number };
  b20Activated?: boolean | null;
  initialLoading?: boolean;
  syncing?: boolean;
  onTradeToken: (token: LaunchedToken | { address: string; symbol: string; name: string; decimals?: number }) => void;
  onRequestCreateToken: () => void;
  guestMode?: boolean;
  onRequestConnect?: () => void;
  onRefreshData?: () => void;
}

export default function ExploreHub({
  app,
  tokens,
  markets,
  marketStats,
  b20Activated = true,
  initialLoading = false,
  syncing = false,
  onTradeToken,
  onRequestCreateToken,
  guestMode = false,
  onRequestConnect,
  onRefreshData,
}: ExploreHubProps) {
  const { wallet } = app;
  const userAddress = wallet?.address ?? null;
  const isConnected = !!userAddress;

  // Holdings hook
  const holdingsTokens = useMemo(
    () => tokens.map((t) => ({ address: t.address, decimals: t.decimals })),
    [tokens]
  );
  const holdings = useTokenHoldings(userAddress ?? undefined, holdingsTokens);

  // Watchlist state
  const [watchlist, setWatchlist] = useState<string[]>([]);
  useEffect(() => {
    setWatchlist(readTokenWatchlist());
  }, []);

  const handleToggleWatch = useCallback((token: UnifiedToken) => {
    toggleTokenWatch(token.address);
    setWatchlist(readTokenWatchlist());
  }, []);

  // Quick view drawer state
  const [selectedQuickViewToken, setSelectedQuickViewToken] = useState<UnifiedToken | null>(null);

  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // ⌘K global listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    const handleCustomOpen = () => setCommandPaletteOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleCustomOpen);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleCustomOpen);
    };
  }, []);

  // Filter state
  const [filters, setFilters] = useState<ExploreFiltersState>({
    catalogTab: "all",
    sort: "trending",
    searchQuery: "",
    onlyWatching: false,
    onlyMine: false,
    hideLowLiquidity: true,
    viewMode: "table",
  });

  // Top movers discovery row liquidity toggle
  const [moversHideLowLiquidity, setMoversHideLowLiquidity] = useState(true);

  // Ref for scrolling to main explorer
  const explorerRef = useRef<HTMLDivElement>(null);
  const handleScrollToExplorer = () => {
    explorerRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. NORMALIZATION: Map all token sources to UnifiedToken
  const allUnifiedTokens = useMemo(() => {
    const list: UnifiedToken[] = [];
    const seenAddresses = new Set<string>();

    // 1a. Launched Tokens (B20 and App meme tokens)
    tokens.forEach((t) => {
      const lower = t.address.toLowerCase();
      seenAddresses.add(lower);
      const mkt = markets[lower] ?? null;
      const isWatched = watchlist.includes(lower);
      const holding = holdings[lower];

      list.push(
        normalizeLaunchedToken(t, mkt, userAddress, isWatched, holding)
      );
    });

    // 1b. Tokenized Stocks (BaseStocks)
    BASE_STOCKS.forEach((stk) => {
      const lower = stk.address.toLowerCase();
      if (!seenAddresses.has(lower)) {
        seenAddresses.add(lower);
        const isWatched = watchlist.includes(lower);
        const holding = holdings[lower];
        list.push(normalizeBaseStock(stk, userAddress, isWatched, holding));
      }
    });

    return list;
  }, [tokens, markets, userAddress, watchlist, holdings]);

  // Counts for catalog tabs
  const catalogCounts = useMemo(() => {
    let stocksCount = 0;
    let b20Count = 0;
    let ecosystemCount = 0;

    allUnifiedTokens.forEach((t) => {
      if (t.type === "stock") stocksCount++;
      else if (t.type === "b20") b20Count++;
      else ecosystemCount++;
    });

    return {
      all: allUnifiedTokens.length,
      stocks: stocksCount,
      b20: b20Count,
      ecosystem: ecosystemCount,
    };
  }, [allUnifiedTokens]);

  // 2. DISCOVERY ROW DATASETS
  // 2a. Spotlight Tokens: Top 3 by Volume
  const spotlightTokens = useMemo(() => {
    return [...allUnifiedTokens]
      .filter((t) => t.hasPool && t.volume24h > 0)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 3);
  }, [allUnifiedTokens]);

  // 2b. Trending (Top by volume / liquidity)
  const trendingTokens = useMemo(() => {
    return [...allUnifiedTokens]
      .filter((t) => t.hasPool)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 8);
  }, [allUnifiedTokens]);

  // 2c. Top Movers (Highest absolute 24h change, filtered by liquidity threshold)
  const topMoversTokens = useMemo(() => {
    return [...allUnifiedTokens]
      .filter((t) => {
        if (!t.hasPool) return false;
        if (moversHideLowLiquidity && t.liquidityUsd < EXPLORE_CONFIG.LOW_LIQUIDITY_THRESHOLD_USD) {
          return false;
        }
        return true;
      })
      .sort((a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h))
      .slice(0, 8);
  }, [allUnifiedTokens, moversHideLowLiquidity]);

  // 2d. Recently Launched
  const recentlyLaunchedTokens = useMemo(() => {
    return [...allUnifiedTokens]
      .filter((t) => t.type !== "stock" && t.createdAt)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 8);
  }, [allUnifiedTokens]);

  // 2e. Tokenized Stocks (Top movers / volume)
  const stockTokens = useMemo(() => {
    return allUnifiedTokens
      .filter((t) => t.type === "stock")
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 8);
  }, [allUnifiedTokens]);

  // 3. MAIN EXPLORER FILTERING & SORTING
  const filteredTokens = useMemo(() => {
    let result = [...allUnifiedTokens];

    // Catalog Tab Filter
    if (filters.catalogTab === "stocks") {
      result = result.filter((t) => t.type === "stock");
    } else if (filters.catalogTab === "b20") {
      result = result.filter((t) => t.type === "b20");
    } else if (filters.catalogTab === "ecosystem") {
      result = result.filter((t) => t.type === "base");
    }

    // Search Query (name, symbol, or 0x address)
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q)
      );
    }

    // Toggles
    if (filters.onlyWatching) {
      result = result.filter((t) => watchlist.includes(t.address.toLowerCase()));
    }

    if (filters.onlyMine) {
      result = result.filter((t) => t.isMine);
    }

    if (filters.hideLowLiquidity) {
      result = result.filter((t) => t.liquidityUsd >= EXPLORE_CONFIG.LOW_LIQUIDITY_THRESHOLD_USD);
    }

    // Sorting
    result.sort((a, b) => {
      if (filters.sort === "trending" || filters.sort === "volume") {
        return b.volume24h - a.volume24h;
      }
      if (filters.sort === "newest") {
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      }
      if (filters.sort === "gainers") {
        return b.priceChange24h - a.priceChange24h;
      }
      if (filters.sort === "losers") {
        return a.priceChange24h - b.priceChange24h;
      }
      if (filters.sort === "mcap") {
        return b.marketCapUsd - a.marketCapUsd;
      }
      return 0;
    });

    return result;
  }, [allUnifiedTokens, filters, watchlist]);

  // Handle in-app trade execution
  const handleTrade = (token: UnifiedToken) => {
    onTradeToken({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
    });
  };

  return (
    <div className="space-y-8 pb-16 animate-meridian-rise">
      {/* 1. COMPACT HERO WITH INTEGRATED ⌘K SEARCH & TOP-3 SPOTLIGHT CAROUSEL */}
      <ExploreHero
        spotlightTokens={spotlightTokens}
        onOpenToken={(t) => setSelectedQuickViewToken(t)}
        onBrowseTokens={handleScrollToExplorer}
        onLaunchToken={onRequestCreateToken}
        searchQuery={filters.searchQuery}
        onSearchChange={(q) => setFilters((prev) => ({ ...prev, searchQuery: q }))}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      {/* 2. DISCOVERY ROWS (Max 8 compact cards, snap-scroll on mobile, grid on desktop) */}
      <div className="space-y-7">
        {/* Row 1: Trending on Base */}
        <DiscoveryRow
          title="Trending on Base"
          description="Tokens with highest 24h trading volume and community DEX activity."
          tokens={trendingTokens}
          onTrade={handleTrade}
          onSelect={(t) => setSelectedQuickViewToken(t)}
          onToggleWatch={handleToggleWatch}
          watchlist={watchlist}
          onViewAll={() => {
            setFilters((prev) => ({ ...prev, sort: "trending", catalogTab: "all" }));
            handleScrollToExplorer();
          }}
        />

        {/* Row 2: Top Movers (with toggle for low liquidity) */}
        <DiscoveryRow
          title="Top Movers"
          description="Tokens exhibiting largest price momentum over the last 24 hours."
          tokens={topMoversTokens}
          onTrade={handleTrade}
          onSelect={(t) => setSelectedQuickViewToken(t)}
          onToggleWatch={handleToggleWatch}
          watchlist={watchlist}
          showLiquidityToggle
          hideLowLiquidity={moversHideLowLiquidity}
          onToggleLowLiquidity={() => setMoversHideLowLiquidity((prev) => !prev)}
          onViewAll={() => {
            setFilters((prev) => ({ ...prev, sort: "gainers", catalogTab: "all" }));
            handleScrollToExplorer();
          }}
        />

        {/* Row 3: Recently Launched (shows slim inline banner if empty) */}
        <DiscoveryRow
          title="Recently Launched"
          description="Latest tokens deployed on Base mainnet with liquidity lockers."
          tokens={recentlyLaunchedTokens}
          onTrade={handleTrade}
          onSelect={(t) => setSelectedQuickViewToken(t)}
          onToggleWatch={handleToggleWatch}
          watchlist={watchlist}
          onLaunch={onRequestCreateToken}
          emptyLabel="No new launches in this block. Be the first creator."
          onViewAll={() => {
            setFilters((prev) => ({ ...prev, sort: "newest", catalogTab: "all" }));
            handleScrollToExplorer();
          }}
        />

        {/* Row 4: Tokenized Stocks (Top Equities on Base) */}
        <DiscoveryRow
          title="Tokenized US Stocks (RWA)"
          description="Coinbase B20 securities backed 1:1 by custodial shares on Base."
          tokens={stockTokens}
          onTrade={handleTrade}
          onSelect={(t) => setSelectedQuickViewToken(t)}
          onToggleWatch={handleToggleWatch}
          watchlist={watchlist}
          onViewAll={() => {
            setFilters((prev) => ({ ...prev, catalogTab: "stocks" }));
            handleScrollToExplorer();
          }}
        />
      </div>

      {/* 4. MAIN EXPLORER SECTION */}
      <div ref={explorerRef} className="space-y-4 pt-2 scroll-mt-20">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-[var(--ink)] tracking-tight">
            Token Explorer
          </h2>
          <span className="text-xs font-mono font-bold text-[var(--ink-muted)]">
            {filteredTokens.length} tokens
          </span>
        </div>

        {/* ONE Filter Bar: Catalog Tab Row, Filter Chips, Toggles & View Mode */}
        <FilterBar
          filters={filters}
          onChangeFilters={setFilters}
          counts={catalogCounts}
          isConnected={isConnected}
        />

        {/* Tokens Table or Grid View */}
        {initialLoading && allUnifiedTokens.length === 0 ? (
          /* Skeletons */
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-xl skeleton-shimmer border border-[var(--border-subtle)]"
              />
            ))}
          </div>
        ) : filteredTokens.length === 0 ? (
          /* Empty State */
          <div className="p-8 sm:p-12 text-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] space-y-2">
            <p className="font-bold text-sm text-[var(--ink)]">
              {filters.onlyWatching
                ? "No tokens in your watchlist yet."
                : filters.onlyMine
                  ? "You haven't launched any tokens with this wallet."
                  : "No tokens found matching your filters."}
            </p>
            <p className="text-xs text-[var(--ink-muted)] max-w-sm mx-auto">
              {filters.onlyWatching
                ? "Click the star icon on any token to track it here."
                : filters.onlyMine
                  ? "Deploy a vanity B20 token or standard ERC-20 to manage it here."
                  : "Try clearing search keywords or unchecking 'Hide low liquidity'."}
            </p>
            {(filters.onlyWatching || filters.onlyMine || filters.searchQuery) && (
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    searchQuery: "",
                    onlyWatching: false,
                    onlyMine: false,
                    hideLowLiquidity: false,
                  }))
                }
                className="mt-2 text-xs font-bold text-[#0052FF] hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <TokenTable
            tokens={filteredTokens}
            onSelectToken={(t) => setSelectedQuickViewToken(t)}
            onTradeToken={handleTrade}
            onToggleWatch={handleToggleWatch}
            watchlist={watchlist}
            viewMode={filters.viewMode}
          />
        )}

        {/* Informational Disclaimer Footnote */}
        <p className="text-xs text-[var(--ink-dim)] text-center pt-3 leading-relaxed">
          Token data is informational. Always check liquidity and contract details before trading. Not financial advice.
        </p>
      </div>

      {/* 5. TOKEN QUICK VIEW DRAWER (Slide-over desktop, bottom-sheet mobile) */}
      <TokenQuickView
        token={selectedQuickViewToken}
        onClose={() => setSelectedQuickViewToken(null)}
        onTrade={handleTrade}
        onToggleWatch={handleToggleWatch}
        isWatched={selectedQuickViewToken ? watchlist.includes(selectedQuickViewToken.address.toLowerCase()) : false}
      />

      {/* 6. COMMAND PALETTE (⌘K / Ctrl+K) */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        tab="launchpad"
        onTabChange={(tab) => {
          if (tab === "launchpad") handleScrollToExplorer();
        }}
        tokens={tokens}
        onOpenToken={(t) => {
          onTradeToken(t);
        }}
      />
    </div>
  );
}
