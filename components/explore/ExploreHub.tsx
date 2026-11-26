"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
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
import StockBaskets from "@/components/stocks/StockBaskets";
import ExploreHero from "./ExploreHero";
import LiveMarketMap from "./LiveMarketMap";
import LatestTradeTicker from "./LatestTradeTicker";
import DiscoveryHub from "./DiscoveryHub";
import FilterBar from "./FilterBar";
import PlaceTabs from "@/components/shell/PlaceTabs";
import { STOCK_LIST_HREF } from "@/lib/constants/destinations";
import TokenTable from "./TokenTable";
import TokenQuickView from "./TokenQuickView";
import MarketIntelligenceHub from "./MarketIntelligenceHub";
import BlurFade from "@/components/ui/motion/BlurFade";
import StockTickerTape from "@/components/markets/StockTickerTape";
import MoversSignalsStrip from "@/components/markets/MoversSignalsStrip";
import LaunchSpotlightStrip from "./LaunchSpotlightStrip";
import StockMarketsTable from "@/components/markets/StockMarketsTable";
import StockDetailDrawer from "@/components/markets/StockDetailDrawer";
import type { StockMarketItem } from "@/lib/markets/types";
import { useStockMarkets } from "@/hooks/useMarketsData";
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

const ROWS_PER_PAGE = 20;

export default function ExploreHub({
  app,
  tokens,
  markets,
  marketStats: _marketStats,
  b20Activated: _b20Activated = true,
  initialLoading = false,
  syncing: _syncing = false,
  onTradeToken,
  onRequestCreateToken,
  guestMode: _guestMode = false,
  onRequestConnect: _onRequestConnect,
  onRefreshData: _onRefreshData,
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

  const handleToggleWatchByAddress = useCallback((address: string) => {
    toggleTokenWatch(address);
    setWatchlist(readTokenWatchlist());
  }, []);

  // Quick view drawer state
  const [selectedQuickViewToken, setSelectedQuickViewToken] = useState<UnifiedToken | null>(null);
  const [selectedStockForDrawer, setSelectedStockForDrawer] = useState<StockMarketItem | null>(null);

  // The three switches arrive in the address: ?list=stocks, ?list=watch, or neither for all tokens.
  const listParam = useSearchParams()?.get("list");
  const [filters, setFilters] = useState<ExploreFiltersState>({
    catalogTab: listParam === "stocks" ? "stocks" : "all",
    sort: "trending",
    searchQuery: "",
    onlyWatching: listParam === "watch",
    onlyMine: false,
    hideLowLiquidity: true,
    onlyVerified: false,
    minVolume100k: false,
    breakoutOnly: false,
    viewMode: "table",
  });

  const {
    stocks: stockMarketsList,
    loading: stockMarketsLoading,
  } = useStockMarkets({
    query: filters.searchQuery,
  });

  // The same screen stays up when the menu is used while already on this page.
  const showList = useCallback((list: string | null | undefined) => {
    setFilters((prev) => ({
      ...prev,
      catalogTab: list === "stocks" ? "stocks" : "all",
      onlyWatching: list === "watch",
    }));
  }, []);
  useEffect(() => {
    showList(listParam);
  }, [listParam, showList]);
  const currentList = filters.onlyWatching ? "watch" : filters.catalogTab === "stocks" ? "stocks" : "all";

  // The list shows one page of rows at a time; changing a filter starts again from the top.
  const [visibleRows, setVisibleRows] = useState(ROWS_PER_PAGE);
  useEffect(() => {
    setVisibleRows(ROWS_PER_PAGE);
  }, [filters]);

  // Extra market panels stay closed (and unloaded) until asked for.
  const [showMarketTools, setShowMarketTools] = useState(false);

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
        list.push(normalizeBaseStock(stk, userAddress, isWatched, holding, markets[lower] ?? null));
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
  // 2a. Spotlight Tokens: Top 10 by Volume (5 visible at once, swipe for the rest)
  const spotlightTokens = useMemo(() => {
    return [...allUnifiedTokens]
      .filter((t) => t.hasPool && t.volume24h > 0)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 10);
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

  // Address → unified token (prices, market cap) for the launch spotlight.
  const unifiedByAddress = useMemo(
    () => new Map(allUnifiedTokens.map((t) => [t.address.toLowerCase(), t] as const)),
    [allUnifiedTokens]
  );

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

    // A watchlist shows everything the person starred, however small.
    if (filters.hideLowLiquidity && !filters.onlyWatching) {
      result = result.filter((t) => t.liquidityUsd >= EXPLORE_CONFIG.LOW_LIQUIDITY_THRESHOLD_USD);
    }

    if (filters.onlyVerified) {
      result = result.filter((t) => t.isVerified);
    }

    if (filters.minVolume100k) {
      result = result.filter((t) => t.volume24h >= 100000);
    }

    if (filters.breakoutOnly) {
      result = result.filter((t) => t.priceChange24h >= 15);
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
        onOpenCommandPalette={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("open-command-palette"));
          }
        }}
      />

      {/* 1.4 LIVE STOCK TICKER TAPE (real prices from the stock markets feed) */}
      <StockTickerTape stocks={stockMarketsList} onSelect={(stock) => setSelectedStockForDrawer(stock)} />

      {/* 4. MAIN EXPLORER SECTION */}
      <div ref={explorerRef} className="space-y-4 pt-2 scroll-mt-20">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-[var(--ink)] tracking-tight">
            Token Explorer
          </h2>
          <span className="text-xs font-mono font-bold text-[var(--ink-muted)]">
            {filteredTokens.length === 0 && (initialLoading || stockMarketsLoading) ? "Loading…" : `${filteredTokens.length} tokens`}
          </span>
        </div>

        <div className="w-full sm:max-w-[480px]">
          <PlaceTabs
            label="Markets"
            current={currentList}
            onSelect={showList}
            items={[
              { id: "stocks", label: "Stocks", href: STOCK_LIST_HREF },
              { id: "all", label: "All tokens", href: "/explore" },
              { id: "watch", label: "Watchlist", href: "/explore?list=watch", badge: watchlist.length },
            ]}
          />
        </div>

        {/* Sorting and filter chips for the token lists; the stock table sorts itself. */}
        {currentList !== "stocks" && (
          <FilterBar
            filters={filters}
            onChangeFilters={setFilters}
            counts={catalogCounts}
            isConnected={isConnected}
          />
        )}

        {/* Tokens Table or Grid View */}
        {currentList === "stocks" ? (
          <div className="space-y-4">
            <StockBaskets />
            <StockMarketsTable
              stocks={stockMarketsList}
              loading={stockMarketsLoading}
              watchlist={watchlist}
              onToggleWatchlist={handleToggleWatchByAddress}
              onSelectStock={(stock) => setSelectedStockForDrawer(stock)}
            />
          </div>
        ) : filteredTokens.length === 0 && (initialLoading || stockMarketsLoading) ? (
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
            {(filters.onlyMine || filters.searchQuery || filters.onlyVerified || filters.minVolume100k || filters.breakoutOnly) && (
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    searchQuery: "",
                    onlyMine: false,
                    hideLowLiquidity: false,
                    onlyVerified: false,
                    minVolume100k: false,
                    breakoutOnly: false,
                  }))
                }
                className="mt-2 text-xs font-bold text-[var(--brand-text)] hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <TokenTable
            tokens={filteredTokens.slice(0, visibleRows)}
            onSelectToken={(t) => setSelectedQuickViewToken(t)}
            onTradeToken={handleTrade}
            onToggleWatch={handleToggleWatch}
            watchlist={watchlist}
            viewMode={filters.viewMode}
          />
        )}

        {currentList !== "stocks" && filteredTokens.length > visibleRows && (
          <button
            type="button"
            onClick={() => setVisibleRows((n) => n + ROWS_PER_PAGE)}
            className="mx-auto flex min-h-[44px] cursor-pointer items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-5 text-sm font-bold text-[var(--brand-text)] transition hover:border-[var(--brand)]"
          >
            Show more ({filteredTokens.length - visibleRows} left)
          </button>
        )}

        {/* Informational Disclaimer Footnote */}
        <p className="text-xs text-[var(--ink-dim)] text-center pt-3 leading-relaxed">
          Token data is informational. Always check liquidity and contract details before trading. Not financial advice.
        </p>
      </div>

      {/* 1.7 LAUNCH SPOTLIGHT: tokens launched through Base Analytics, newest first */}
      <BlurFade>
        <LaunchSpotlightStrip
          tokens={tokens}
          unifiedByAddress={unifiedByAddress}
          onOpen={(t) => setSelectedQuickViewToken(t)}
          onTrade={handleTrade}
          onLaunch={onRequestCreateToken}
        />
      </BlurFade>

      {/* More market panels: trending rows, live map, signals and alerts */}
      <div className="space-y-8">
        <button
          type="button"
          aria-expanded={showMarketTools}
          onClick={() => setShowMarketTools((v) => !v)}
          className="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-left transition hover:border-[var(--brand)]"
        >
          <span>
            <span className="block text-sm font-black text-[var(--ink)]">Market tools</span>
            <span className="block text-xs text-[var(--ink-muted)]">Trending, live trades, stock signals, wallet watch and price alerts</span>
          </span>
          <ChevronDown size={18} aria-hidden className={`shrink-0 transition-transform ${showMarketTools ? "rotate-180" : ""}`} />
        </button>

        {showMarketTools && (
          <>
            {/* 1.2 LATEST TRADE: live pill cycling the newest buys / sells */}
            <LatestTradeTicker tokens={allUnifiedTokens} />

            {/* 1.6 MARKET SIGNALS & MOVERS (Top Gainer, Most Liquid, Top Collateral, Lowest Impact) */}
            <BlurFade>
              <MoversSignalsStrip
                stocks={stockMarketsList}
                loading={stockMarketsLoading}
                onSelectStock={(stock) => setSelectedStockForDrawer(stock)}
              />
            </BlurFade>

            {/* 2. DISCOVERY HUB (Segmented Tabs: Trending | Top Gainers | New Launches | Stocks) */}
            <BlurFade>
            <DiscoveryHub
              trendingTokens={trendingTokens}
              topMoversTokens={topMoversTokens}
              recentlyLaunchedTokens={recentlyLaunchedTokens}
              stockTokens={stockTokens}
              onTrade={handleTrade}
              onSelect={(t) => setSelectedQuickViewToken(t)}
              onToggleWatch={handleToggleWatch}
              watchlist={watchlist}
              moversHideLowLiquidity={moversHideLowLiquidity}
              onToggleLowLiquidity={() => setMoversHideLowLiquidity((prev) => !prev)}
              onLaunch={onRequestCreateToken}
              onViewAllCategory={(cat) => {
                if (cat === "trending") {
                  setFilters((prev) => ({ ...prev, sort: "trending", catalogTab: "all", onlyWatching: false }));
                } else if (cat === "gainers") {
                  setFilters((prev) => ({ ...prev, sort: "gainers", catalogTab: "all", onlyWatching: false }));
                } else if (cat === "new") {
                  setFilters((prev) => ({ ...prev, sort: "newest", catalogTab: "all", onlyWatching: false }));
                } else if (cat === "stocks") {
                  showList("stocks");
                }
                handleScrollToExplorer();
              }}
            />
            </BlurFade>

            {/* 2.5 LIVE MARKET: volume bubbles + latest buys/sells feed */}
            <BlurFade>
              <LiveMarketMap tokens={allUnifiedTokens} onOpenToken={(t) => setSelectedQuickViewToken(t)} />
            </BlurFade>

            {/* 3. MARKET INTELLIGENCE HUB (Stock price check, wallet watch, price alerts) */}
            <MarketIntelligenceHub
              userWallet={userAddress}
              onTradeToken={(addr) => {
                const matched = allUnifiedTokens.find((t) => t.address.toLowerCase() === addr.toLowerCase());
                if (matched) handleTrade(matched);
              }}
              stockMarkets={stockMarketsList}
            />
          </>
        )}
      </div>

      {/* 5. TOKEN QUICK VIEW DRAWER (Slide-over desktop, bottom-sheet mobile) */}
      <TokenQuickView
        token={selectedQuickViewToken}
        onClose={() => setSelectedQuickViewToken(null)}
        onTrade={handleTrade}
        onToggleWatch={handleToggleWatch}
        isWatched={selectedQuickViewToken ? watchlist.includes(selectedQuickViewToken.address.toLowerCase()) : false}
      />

      {/* 5.5 STOCK DETAIL DRAWER (Slide-over desktop, bottom-sheet mobile with full venues & 1-tap swap) */}
      <StockDetailDrawer
        stock={selectedStockForDrawer}
        open={Boolean(selectedStockForDrawer)}
        onClose={() => setSelectedStockForDrawer(null)}
        isWatched={
          selectedStockForDrawer
            ? watchlist.includes(selectedStockForDrawer.address.toLowerCase())
            : false
        }
        onToggleWatchlist={handleToggleWatchByAddress}
      />
    </div>
  );
}
