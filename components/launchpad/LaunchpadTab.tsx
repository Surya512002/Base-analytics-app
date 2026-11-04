"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buildSwapLink } from "@/lib/swap/swap-link";
const TokenLaunchForm = dynamic(
  () => import("@/components/launchpad/TokenLaunchForm"),
  { loading: () => <div className="h-64 skeleton-shimmer rounded-3xl border border-[var(--border-subtle)]" /> }
);
const TokenDetailPanel = dynamic(
  () => import("@/components/launchpad/TokenDetailPanel"),
  { loading: () => <div className="h-96 skeleton-shimmer rounded-3xl border border-[var(--border-subtle)]" /> }
);
import { fetchLaunchpadTokens, fetchDiscoverTokens } from "@/lib/api/launchpad-client";
import { fetchMarketData, fetchMarketBatch } from "@/lib/api/launchpad-market-client";
import { mergeMarketSummaries, type TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { readExploreCache, writeExploreCache, hasExploreCache } from "@/lib/launchpad/explore-cache";
import { mergeExploreTokens } from "@/lib/launchpad/merge-tokens";
import { isAppLaunched, isB20ExploreToken } from "@/lib/launchpad/token-meta";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { WalletAppState, AppTab } from "@/hooks/useWalletApp";
import ExploreHub from "@/components/explore/ExploreHub";
import StockDetailComparisonModal from "@/components/stocks/StockDetailComparisonModal";
import type { CoinbaseTokenizedStock } from "@/lib/stocks/coinbase-api";
import { checkAlerts } from "@/lib/utils/token-price-alerts";
import { buildExploreTokenPath, syncTabUrl } from "@/lib/utils/app-url";

type View = "explore" | "create" | "trade";

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
  onNavigate?: (tab: AppTab, opts?: { token?: string | null; buy?: string | null; sell?: string | null; amount?: string | number | null }) => void;
  isActive?: boolean;
  initialView?: View;
}) {
  const router = useRouter();
  const { wallet, b20Activated: appB20Activated } = app;
  const [view, setView] = useState<View>(() => {
    if (initialView) return initialView;
    if (typeof window !== "undefined" && (window.location.pathname.startsWith("/launch") || window.location.search.includes("create=1"))) {
      return "create";
    }
    return "explore";
  });
  const [selectedLendingStock, setSelectedLendingStock] = useState<CoinbaseTokenizedStock | null>(null);
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
  const refreshGenRef = useRef(0);
  const refreshInFlightRef = useRef(false);
  const hasCatalogRef = useRef(catalog.tokens.length > 0);
  const appRef = useRef(app);

  useEffect(() => {
    appRef.current = app;
    hasCatalogRef.current = catalog.tokens.length > 0;
  }, [app, catalog.tokens.length]);

  const launchEnabled = b20Activated === true || appB20Activated === true;

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
    (token: LaunchedToken | { address: string }) => {
      if ("symbol" in token && "name" in token) {
        ensureTokenInCatalog(token as LaunchedToken);
      }
      syncTabUrl("swap", { buy: token.address });
      if (onNavigate) {
        onNavigate("swap", { buy: token.address });
      } else if (typeof window !== "undefined") {
        router.push(buildSwapLink({ buy: token.address }));
      }
    },
    [ensureTokenInCatalog, onNavigate, router]
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [view, selected?.address]);

  const goExplore = () => {
    setView("explore");
    setSelected(null);
    syncTokenUrl(null);
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
