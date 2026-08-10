"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
const TokenLaunchForm = dynamic(
  () => import("@/components/launchpad/TokenLaunchForm"),
  { loading: () => <div className="h-64 glass-panel rounded-3xl animate-pulse" /> }
);
const TokenDetailPanel = dynamic(
  () => import("@/components/launchpad/TokenDetailPanel"),
  { loading: () => <div className="h-96 glass-panel rounded-3xl animate-pulse" /> }
);
import TokenCard, { CreateTokenCard } from "@/components/launchpad/TokenCard";
import { fetchLaunchpadTokens, fetchDiscoverTokens, resolveTokenByAddress } from "@/lib/api/launchpad-client";
import { fetchMarketData, fetchMarketBatch, fetchGlobalActivity } from "@/lib/api/launchpad-market-client";
import type { GlobalActivityItem } from "@/lib/api/launchpad-market-client";
import { mergeMarketSummaries, type TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { readExploreCache, writeExploreCache, hasExploreCache } from "@/lib/launchpad/explore-cache";
import { mergeExploreTokens, sortByMarketVolume } from "@/lib/launchpad/merge-tokens";
import { filterCatalogTokens, filterTradableExploreTokens } from "@/lib/launchpad/tradable";
import { isAppLaunched, isB20ExploreToken } from "@/lib/launchpad/token-meta";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { WalletAppState, AppTab } from "@/hooks/useWalletApp";
import MyLaunchedTokens from "@/components/launchpad/MyLaunchedTokens";
import AgenticMarketplaceRail, { ExploreKnowledgeRail } from "@/components/explore/AgenticMarketplaceRail";
import ExploreLandingHero from "@/components/explore/ExploreLandingHero";
import B20MarketHero from "@/components/explore/B20MarketHero";
import ExploreSegmentTabs, { type TokenCatalogTab } from "@/components/explore/ExploreSegmentTabs";
import ExploreSearchBar from "@/components/explore/ExploreSearchBar";
import ExploreOnboarding from "@/components/explore/ExploreOnboarding";
import ExploreMobileFab from "@/components/explore/ExploreMobileFab";
import WatchlistAlertsPanel from "@/components/explore/WatchlistAlertsPanel";
import { useTokenHoldings } from "@/hooks/useTokenHoldings";
import { checkAlerts } from "@/lib/utils/token-price-alerts";
import LaunchpadExploreSections from "@/components/launchpad/LaunchpadExploreSections";
import RecentlyLaunchedSection from "@/components/launchpad/RecentlyLaunchedSection";
import B20TokensSection from "@/components/launchpad/B20TokensSection";
import LaunchCalendar from "@/components/launchpad/LaunchCalendar";
import TokenWatchlistRail from "@/components/launchpad/TokenWatchlistRail";
import GlobalActivityTicker from "@/components/shell/GlobalActivityTicker";
import LiveMarketStrip from "@/components/shell/LiveMarketStrip";
import ExploreServicesRail from "@/components/shell/ExploreServicesRail";
import {
  readTokenWatchlist,
  toggleTokenWatch,
} from "@/lib/utils/token-watchlist";
import { buildExploreTokenPath } from "@/lib/utils/app-url";
import type { X402ProductId } from "@/lib/constants/x402-products";

type View = "explore" | "create" | "trade";
type Filter =
  | "all"
  | "newest"
  | "trending"
  | "volume"
  | "mcap"
  | "mine"
  | "gainers"
  | "losers"
  | "watchlist";

type ExploreCatalog = {
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
  marketStats: { totalVolume24h: number; totalLiquidity: number };
  b20Activated: boolean | null;
};

function catalogFromCache(): ExploreCatalog {
  const cached = readExploreCache();
  return {
    tokens: cached?.tokens ?? [],
    markets: cached?.markets ?? {},
    marketStats: cached?.marketStats ?? { totalVolume24h: 0, totalLiquidity: 0 },
    b20Activated: cached?.b20Activated ?? null,
  };
}

export type LaunchpadShellBridge = {
  tokens: LaunchedToken[];
  openCreate: () => void;
  openToken: (token: LaunchedToken) => void;
  b20Activated: boolean | null;
};

function syncTokenUrl(token: LaunchedToken | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.pathname.startsWith("/explore/token/")) {
    if (token) {
      window.history.replaceState({}, "", buildExploreTokenPath(token.address));
    } else {
      window.history.replaceState({}, "", "/explore");
    }
    return;
  }
  url.searchParams.set("tab", "launchpad");
  if (token) url.searchParams.set("token", token.address);
  else url.searchParams.delete("token");
  window.history.replaceState({}, "", url);
}

export default function LaunchpadTab({
  app,
  guestMode,
  onRequestConnect,
  onShellBridge,
  onNavigate,
  onPayAgent,
  isActive = true,
  focusToken,
}: {
  app: WalletAppState;
  guestMode?: boolean;
  onRequestConnect?: () => void;
  onShellBridge?: (bridge: LaunchpadShellBridge) => void;
  onNavigate?: (tab: AppTab, opts?: { token?: string | null }) => void;
  onPayAgent?: (productId: X402ProductId) => void;
  isActive?: boolean;
  /** Deep-link `/explore/token/0x…` — open token detail (swap + seed + holders). */
  focusToken?: string | null;
}) {
  const { wallet, b20Activated: appB20Activated } = app;
  const [view, setView] = useState<View>("explore");
  const [catalogTab, setCatalogTab] = useState<TokenCatalogTab>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [b20Filter, setB20Filter] = useState<
    "all" | "trending" | "newest" | "gainers" | "volume" | "mine" | "watchlist"
  >("all");
  const cachedExplore = readExploreCache();
  const [catalog, setCatalog] = useState<ExploreCatalog>(() =>
    cachedExplore
      ? {
          tokens: cachedExplore.tokens,
          markets: cachedExplore.markets,
          marketStats: cachedExplore.marketStats,
          b20Activated: cachedExplore.b20Activated,
        }
      : catalogFromCache()
  );
  const { tokens, markets, marketStats, b20Activated } = catalog;
  const [selected, setSelected] = useState<LaunchedToken | null>(null);
  const [initialLoading, setInitialLoading] = useState(!hasExploreCache());
  const [syncing, setSyncing] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [activities, setActivities] = useState<GlobalActivityItem[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const refreshGenRef = useRef(0);
  const refreshInFlightRef = useRef(false);
  const hasCatalogRef = useRef(catalog.tokens.length > 0);
  const appRef = useRef(app);
  appRef.current = app;
  hasCatalogRef.current = catalog.tokens.length > 0;
  const launchEnabled = b20Activated === true || appB20Activated === true;

  const scrollToGrid = useCallback(() => {
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (!isActive) return;
    let alive = true;
    const load = () =>
      void fetchGlobalActivity(48).then((d) => {
        if (alive) setActivities(d.activities);
      });
    load();
    const id = setInterval(load, 90_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isActive]);

  useEffect(() => {
    setWatchlist(readTokenWatchlist());
  }, []);

  const handleToggleWatch = useCallback((address: string) => {
    toggleTokenWatch(address);
    setWatchlist(readTokenWatchlist());
  }, []);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (refreshInFlightRef.current) return null;
    refreshInFlightRef.current = true;
    const gen = ++refreshGenRef.current;
    const silent = opts?.silent === true || hasCatalogRef.current;
    if (!silent) setInitialLoading(true);
    else setSyncing(true);
    try {
      const [data, discover, marketData] = await Promise.all([
        fetchLaunchpadTokens(),
        fetchDiscoverTokens(),
        fetchMarketData(),
      ]);
      const merged = mergeExploreTokens(data.tokens, discover.tokens);
      let nextMarkets = mergeMarketSummaries(discover.markets, marketData.markets);

      const missingPool = merged
        .map((t) => t.address.toLowerCase())
        .filter((a) => {
          const m = nextMarkets[a];
          return !m?.hasPool || (m.liquidityUsd ?? 0) < 1_000;
        });
      if (missingPool.length > 0) {
        const dexMarkets = await fetchMarketBatch(missingPool.slice(0, 60));
        nextMarkets = mergeMarketSummaries(nextMarkets, dexMarkets);
      }

      const b20Addrs = merged
        .filter(isB20ExploreToken)
        .map((t) => t.address.toLowerCase());
      const needsDex = b20Addrs.filter((a) => {
        const m = nextMarkets[a];
        return !m || m.priceChange24h == null || m.volume24h == null;
      });
      if (needsDex.length > 0) {
        const dexMarkets = await fetchMarketBatch(needsDex);
        nextMarkets = mergeMarketSummaries(nextMarkets, dexMarkets);
      }

      if (gen !== refreshGenRef.current) return null;

      const stats = {
        totalVolume24h: marketData.stats.totalVolume24h,
        totalLiquidity: marketData.stats.totalLiquidity,
      };
      const nextCatalog: ExploreCatalog = {
        tokens: merged,
        markets: nextMarkets,
        marketStats: stats,
        b20Activated: data.b20Activated,
      };
      setCatalog(nextCatalog);
      writeExploreCache({
        tokens: merged,
        markets: nextMarkets,
        b20Activated: data.b20Activated,
        marketStats: stats,
      });

      return merged;
    } catch (e) {
      console.error("[LaunchpadTab] refresh failed", e);
      if (!silent) {
        appRef.current.showToast("Could not refresh markets — will retry shortly", "");
      }
      return null;
    } finally {
      if (gen === refreshGenRef.current) {
        refreshInFlightRef.current = false;
        setInitialLoading(false);
        setSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void refresh({ silent: hasExploreCache() });
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void refresh({ silent: true });
    }, 60_000);
    return () => clearInterval(id);
  }, [isActive, refresh]);

  const ensureTokenInCatalog = useCallback((token: LaunchedToken) => {
    setCatalog((prev) => {
      const key = token.address.toLowerCase();
      if (prev.tokens.some((t) => t.address.toLowerCase() === key)) return prev;
      const launched = prev.tokens.filter(isAppLaunched);
      const external = prev.tokens.filter((t) => !isAppLaunched(t));
      return {
        ...prev,
        tokens: mergeExploreTokens(launched, [token, ...external]),
      };
    });
  }, []);

  const openSwap = useCallback(
    (token: LaunchedToken) => {
      ensureTokenInCatalog(token);
      // Deep-link so /explore forceTab cannot strip the address when routing to swap.
      onNavigate?.("swap", { token: token.address });
    },
    [ensureTokenInCatalog, onNavigate]
  );

  const openDetail = useCallback(
    (token: LaunchedToken) => {
      ensureTokenInCatalog(token);
      setSelected(token);
      setView("trade");
      syncTokenUrl(token);
    },
    [ensureTokenInCatalog]
  );

  const openDetailByAddress = useCallback(
    async (addr: string) => {
      const found = tokens.find((t) => t.address.toLowerCase() === addr.toLowerCase());
      if (found) {
        openDetail(found);
        return;
      }
      const { token, market } = await resolveTokenByAddress(addr);
      if (!token) {
        app.showToast(
          addr.toLowerCase().startsWith("0xb20")
            ? "B20 token not found on Base — check the deploy tx on BaseScan or wait a minute and retry"
            : "Token not found or no liquidity on Base",
          ""
        );
        return;
      }
      setCatalog((prev) => {
        const launched = prev.tokens.filter(isAppLaunched);
        const external = prev.tokens.filter((t) => !isAppLaunched(t));
        const nextTokens = mergeExploreTokens(launched, [token, ...external]);
        const key = token.address.toLowerCase();
        return {
          ...prev,
          tokens: nextTokens,
          markets: market ? { ...prev.markets, [key]: market } : prev.markets,
        };
      });
      openDetail(token);
    },
    [tokens, openDetail, app]
  );

  const openTradeByAddress = useCallback(
    async (addr: string) => {
      const found = tokens.find((t) => t.address.toLowerCase() === addr.toLowerCase());
      if (found) {
        openSwap(found);
        return;
      }
      const { token, market } = await resolveTokenByAddress(addr);
      if (!token) {
        app.showToast(
          addr.toLowerCase().startsWith("0xb20")
            ? "B20 token not found on Base — check the deploy tx on BaseScan or wait a minute and retry"
            : "Token not found or no liquidity on Base",
          ""
        );
        return;
      }
      setCatalog((prev) => {
        const launched = prev.tokens.filter(isAppLaunched);
        const external = prev.tokens.filter((t) => !isAppLaunched(t));
        const nextTokens = mergeExploreTokens(launched, [token, ...external]);
        const key = token.address.toLowerCase();
        return {
          ...prev,
          tokens: nextTokens,
          markets: market ? { ...prev.markets, [key]: market } : prev.markets,
        };
      });
      openSwap(token);
    },
    [tokens, openSwap, app]
  );

  // Deep-link /explore/token/0x… → token terminal (seed retry, holders, chart).
  const focusHandledRef = useRef<string | null>(null);
  useEffect(() => {
    const addr = focusToken?.trim().toLowerCase();
    if (!addr?.startsWith("0x") || addr.length !== 42) return;
    if (focusHandledRef.current === addr) return;
    focusHandledRef.current = addr;
    void openDetailByAddress(addr);
  }, [focusToken, openDetailByAddress]);

  const requestCreate = useCallback(() => {
    if (guestMode) {
      onRequestConnect?.();
      return;
    }
    setView("create");
  }, [guestMode, onRequestConnect]);

  useEffect(() => {
    onShellBridge?.({
      tokens,
      openCreate: requestCreate,
      openToken: openSwap,
      b20Activated: launchEnabled,
    });
  }, [tokens, launchEnabled, onShellBridge, requestCreate, openSwap]);

  const allNonB20Tokens = useMemo(
    () => tokens.filter((t) => !isB20ExploreToken(t)),
    [tokens]
  );

  const allB20Tokens = useMemo(() => tokens.filter(isB20ExploreToken), [tokens]);

  const tradableTokens = useMemo(
    () => filterTradableExploreTokens(tokens, markets),
    [tokens, markets]
  );

  const tradableB20 = useMemo(
    () => tradableTokens.filter(isB20ExploreToken),
    [tradableTokens]
  );

  const catalogTokens = useMemo(
    () =>
      filterCatalogTokens(allNonB20Tokens, markets, {
        includeMine: true,
        wallet: wallet?.address,
      }),
    [allNonB20Tokens, markets, wallet?.address]
  );

  const filtered = useMemo(() => {
    let list = [...catalogTokens];

    if (filter === "newest") {
      list.sort((a, b) => b.createdAt - a.createdAt);
    } else if (filter === "trending") {
      list = sortByMarketVolume(list, markets).filter(
        (t) => (markets[t.address.toLowerCase()]?.volume24h ?? 0) > 0
      );
    } else if (filter === "volume") {
      list.sort((a, b) => {
        const va = markets[a.address.toLowerCase()]?.volume24h ?? 0;
        const vb = markets[b.address.toLowerCase()]?.volume24h ?? 0;
        return vb - va || b.createdAt - a.createdAt;
      });
    } else if (filter === "mcap") {
      list.sort((a, b) => {
        const ma = markets[a.address.toLowerCase()]?.marketCap ?? 0;
        const mb = markets[b.address.toLowerCase()]?.marketCap ?? 0;
        return mb - ma || b.createdAt - a.createdAt;
      });
    } else if (filter === "gainers") {
      list = list
        .filter((t) => (markets[t.address.toLowerCase()]?.priceChange24h ?? 0) > 0)
        .sort(
          (a, b) =>
            (markets[b.address.toLowerCase()]?.priceChange24h ?? 0) -
            (markets[a.address.toLowerCase()]?.priceChange24h ?? 0)
        );
    } else if (filter === "losers") {
      list = list
        .filter((t) => (markets[t.address.toLowerCase()]?.priceChange24h ?? 0) < 0)
        .sort(
          (a, b) =>
            (markets[a.address.toLowerCase()]?.priceChange24h ?? 0) -
            (markets[b.address.toLowerCase()]?.priceChange24h ?? 0)
        );
    } else if (filter === "watchlist") {
      list = watchlist
        .map((addr) => allNonB20Tokens.find((t) => t.address.toLowerCase() === addr))
        .filter((t): t is LaunchedToken => Boolean(t));
    } else if (filter === "mine" && wallet) {
      const w = wallet.address.toLowerCase();
      list = list.filter((t) => isAppLaunched(t) && t.creator.toLowerCase() === w);
    }

    return list;
  }, [catalogTokens, allNonB20Tokens, filter, wallet, markets, watchlist]);

  const holdingInputs = useMemo(
    () => tradableTokens.map((t) => ({ address: t.address, decimals: t.decimals })),
    [tradableTokens]
  );
  const holdings = useTokenHoldings(wallet?.address, holdingInputs);

  useEffect(() => {
    if (!isActive || typeof Notification === "undefined") return;
    checkAlerts(markets, (alert, price) => {
      if (Notification.permission === "granted") {
        new Notification(`${alert.symbol} price alert`, {
          body: `Price hit $${price.toFixed(4)} (target ${alert.direction} $${alert.priceUsd})`,
        });
      }
      app.showToast(`${alert.symbol} hit $${price.toFixed(4)}`, "");
    });
  }, [markets, isActive, app]);

  const goExplore = () => {
    setView("explore");
    setSelected(null);
    syncTokenUrl(null);
  };

  const handleActivityToken = (address: string) => {
    void openTradeByAddress(address);
  };

  if (view === "create") {
    if (guestMode) {
      onRequestConnect?.();
      return null;
    }
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={goExplore}
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ink)] hover:text-[var(--ink)]"
        >
          <ArrowLeft size={16} /> Back to explore
        </button>
        <TokenLaunchForm
          app={app}
          onLaunched={() => void refresh()}
          onTrade={(token) => openSwap(token)}
          onExplore={goExplore}
        />
      </div>
    );
  }

  if (view === "trade" && selected) {
    return (
      <TokenDetailPanel
        app={app}
        token={selected}
        onBack={goExplore}
        guestMode={guestMode}
        onRequestConnect={onRequestConnect}
        onTrade={() => openSwap(selected)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ExploreLandingHero
        tokens={tradableTokens}
        b20Tokens={allB20Tokens}
        markets={markets}
        marketLoading={initialLoading && tradableTokens.length === 0}
        guestMode={guestMode}
        onLaunch={requestCreate}
        onOpenToken={openSwap}
        onConnect={onRequestConnect}
        onBrowseTrending={scrollToGrid}
        onConnectToTrade={onRequestConnect}
        totalVolume24h={marketStats.totalVolume24h}
        totalLiquidity={marketStats.totalLiquidity}
      />

      <ExploreSearchBar
        tokens={tradableTokens}
        onOpenToken={openSwap}
        onBrowseTrending={scrollToGrid}
      />

      <LiveMarketStrip
        tokenCount={tradableTokens.length}
        b20Live={b20Activated !== false}
        volume24h={marketStats.totalVolume24h}
        syncing={syncing}
      />

      <B20MarketHero
        tokens={tradableB20}
        markets={markets}
        onOpen={openSwap}
        onLaunch={guestMode ? undefined : requestCreate}
        loading={initialLoading && tradableB20.length === 0}
        guestMode={guestMode}
      />

      <RecentlyLaunchedSection
        tokens={tokens}
        markets={markets}
        onOpen={openSwap}
        onLaunch={guestMode ? undefined : requestCreate}
        syncing={syncing || (initialLoading && tokens.length === 0)}
        guestMode={guestMode}
      />

      <LaunchpadExploreSections
        tokens={tradableTokens}
        markets={markets}
        onOpen={openSwap}
        syncing={syncing}
      />

      <GlobalActivityTicker onOpenToken={handleActivityToken} />

      <ExploreServicesRail
        onNavigate={onNavigate ?? ((t) => app.setTab(t))}
        guest={guestMode}
        onConnect={onRequestConnect}
      />

      {watchlist.length > 0 && (
        <>
          <TokenWatchlistRail
            tokens={tradableTokens}
            markets={markets}
            watchlist={watchlist}
            onOpen={openSwap}
            onToggleWatch={handleToggleWatch}
            pinned
            holdings={holdings}
          />
          <WatchlistAlertsPanel
            watchlist={watchlist}
            tokens={tradableTokens}
            markets={markets}
            walletAddress={app.wallet?.address}
          />
        </>
      )}

      <div ref={gridRef} className="space-y-4 scroll-mt-24">
        <ExploreSegmentTabs active={catalogTab} onChange={setCatalogTab} />

        {catalogTab === "all" ? (
          <>
            <p className="text-[12px] text-[var(--ink-dim)]">
              Base ecosystem tokens with live liquidity on Uniswap &amp; Aerodrome.
            </p>

            <div className="flex gap-x-3 sm:gap-x-4 gap-y-1 overflow-x-auto no-scrollbar touch-scroll-x border-b border-[var(--border-subtle)] -mx-1 px-1">
              {(
                [
                  { id: "all" as const, label: "All" },
                  { id: "trending" as const, label: "Trending" },
                  { id: "newest" as const, label: "New" },
                  { id: "volume" as const, label: "Volume" },
                  { id: "mcap" as const, label: "Market cap" },
                  { id: "gainers" as const, label: "Top gainers" },
                  { id: "losers" as const, label: "Losers" },
                  { id: "watchlist" as const, label: "Watching" },
                  { id: "mine" as const, label: "Mine" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`filter-tab shrink-0 min-h-[40px] touch-manipulation ${filter === id ? "filter-tab-active" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {initialLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-52 rounded-xl bg-[var(--bg-raised)] animate-pulse border border-[var(--border-subtle)]"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {!guestMode && <CreateTokenCard onCreate={requestCreate} />}
                {filtered.map((t) => (
                  <TokenCard
                    key={t.address}
                    token={t}
                    market={markets[t.address.toLowerCase()]}
                    onOpen={() => openDetail(t)}
                    onTrade={() => openSwap(t)}
                    isMine={
                      isAppLaunched(t) &&
                      wallet?.address.toLowerCase() === t.creator.toLowerCase()
                    }
                    watched={watchlist.includes(t.address.toLowerCase())}
                    onToggleWatch={() => handleToggleWatch(t.address)}
                    holdingBalance={holdings[t.address.toLowerCase()]}
                  />
                ))}
              </div>
            )}

            {!initialLoading && filtered.length === 0 && filter !== "all" && (
              <p className="text-center text-sm text-[var(--ink-dim)] py-8">
                No tokens match this filter yet. Launch the first one on Base.
              </p>
            )}
          </>
        ) : (
          <B20TokensSection
            tokens={tradableB20}
            allTokens={allB20Tokens}
            markets={markets}
            loading={initialLoading}
            filter={b20Filter}
            onFilterChange={setB20Filter}
            onOpen={openDetail}
            onTrade={openSwap}
            onCreate={requestCreate}
            guestMode={guestMode}
            wallet={wallet?.address}
            watchlist={watchlist}
            onToggleWatch={handleToggleWatch}
          />
        )}
      </div>

      <LaunchCalendar onOpenToken={handleActivityToken} />

      {wallet && (
        <MyLaunchedTokens
          tokens={tokens.filter(isAppLaunched)}
          wallet={wallet.address}
          onOpen={openDetail}
        />
      )}

      <AgenticMarketplaceRail
        onNavigate={onNavigate}
        guest={guestMode}
        onConnect={onRequestConnect}
        onPayAgent={onPayAgent}
      />
      <ExploreKnowledgeRail />

      <ExploreOnboarding />
      <ExploreMobileFab
        onBrowse={scrollToGrid}
        onLaunch={requestCreate}
        guest={guestMode}
        onConnect={onRequestConnect}
      />
    </div>
  );
}
