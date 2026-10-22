"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
const TokenLaunchForm = dynamic(
  () => import("@/components/launchpad/TokenLaunchForm"),
  { loading: () => <div className="h-64 skeleton-shimmer rounded-3xl border border-[var(--border-subtle)]" /> }
);
const TokenDetailPanel = dynamic(
  () => import("@/components/launchpad/TokenDetailPanel"),
  { loading: () => <div className="h-96 skeleton-shimmer rounded-3xl border border-[var(--border-subtle)]" /> }
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
import ExploreHub from "@/components/explore/ExploreHub";
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
import StocksExploreSection from "@/components/stocks/StocksExploreSection";
import StockDetailComparisonModal from "@/components/stocks/StockDetailComparisonModal";
import type { CoinbaseTokenizedStock } from "@/lib/stocks/coinbase-api";
import {
  readTokenWatchlist,
  toggleTokenWatch,
} from "@/lib/utils/token-watchlist";
import { buildExploreTokenPath, syncTabUrl } from "@/lib/utils/app-url";

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
  isActive = true,
  initialView,
}: {
  app: WalletAppState;
  guestMode?: boolean;
  onRequestConnect?: () => void;
  onShellBridge?: (bridge: LaunchpadShellBridge) => void;
  onNavigate?: (tab: AppTab, opts?: { token?: string | null }) => void;
  isActive?: boolean;
  initialView?: View;
}) {
  const { wallet, b20Activated: appB20Activated } = app;
  const [view, setView] = useState<View>(() => {
    if (initialView) return initialView;
    if (typeof window !== "undefined" && (window.location.pathname.startsWith("/launch") || window.location.search.includes("create=1"))) {
      return "create";
    }
    return "explore";
  });
  const [catalogTab, setCatalogTab] = useState<TokenCatalogTab>("all");
  const [selectedLendingStock, setSelectedLendingStock] = useState<CoinbaseTokenizedStock | null>(null);
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
      syncTabUrl("swap", { token: token.address });
      onNavigate?.("swap", { token: token.address });
    },
    [ensureTokenInCatalog, onNavigate]
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
          addr.startsWith("0xb20")
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
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={goExplore}
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--ink)] hover:text-[var(--brand)] transition-colors"
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
      <TokenDetailPanel app={app} token={selected} onBack={goExplore} guestMode={guestMode} onRequestConnect={onRequestConnect} />
    );
  }

  return (
    <>
      <ExploreHub
        app={app}
        tokens={tokens}
        markets={markets}
        marketStats={marketStats}
        b20Activated={b20Activated}
        initialLoading={initialLoading}
        syncing={syncing}
        onTradeToken={(t) => openSwap(t as LaunchedToken)}
        onRequestCreateToken={requestCreate}
        guestMode={guestMode}
        onRequestConnect={onRequestConnect}
        onRefreshData={() => void refresh()}
      />

      {selectedLendingStock && (
        <StockDetailComparisonModal
          stock={selectedLendingStock}
          userAddress={wallet?.address}
          connType={app.connType}
          onClose={() => setSelectedLendingStock(null)}
          onRequestConnect={onRequestConnect}
          onSuccess={() => {
            app.showToast("Action confirmed on Base!", "success");
          }}
        />
      )}
    </>
  );
}
