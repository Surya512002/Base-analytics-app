"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { BASE_STOCKS, ALL_BASE_STOCKS } from "@/lib/stocks/base-stocks";
import { isNewStock } from "@/lib/stocks/tokenized-stocks-registry";
import { BASE_LENDING_MARKETS } from "@/lib/lending/markets";
import type { LendingMarket } from "@/lib/lending/types";
import {
  getUnifiedStockLendingComparison,
  type StockLendingComparison,
  type StockLendingOption,
} from "@/lib/lending/unified-comparison";
import { deriveStockMarketOptions } from "@/lib/lending/market-classifier";
import { MIN_TVL_USD } from "@/lib/lending/constants";
import { getBaselineVerifiedMarkets } from "@/lib/lending/discovery/baseline";
import LendingHeader from "./LendingHeader";
import MarketsOverviewStrip from "@/components/markets/MarketsOverviewStrip";
import { useMarketsOverview } from "@/hooks/useMarketsData";
import LendingViewTabs, { type LendingViewTab } from "./LendingViewTabs";
import PositionsPanel from "./PositionsPanel";
import {
  fetchAllUserPositions,
  readBeefyPositions,
  readAavePositions,
  readIporPositions,
  readAerodromeGaugePositions,
  type UserProtocolPosition,
} from "@/lib/lending/user-positions";
import { getEip1193Provider } from "@/app/connection";
import { ensureBaseNetwork } from "@/lib/utils/wallet-connection";
import MarketsTable, { type AssetMarketRow, type ProtocolRateInfo } from "./MarketsTable";
import GaugesTable, { type GaugeRowData } from "./GaugesTable";
import AssetDetailView from "./AssetDetailView";
import ProtocolCompareHub from "./ProtocolCompareHub";
import TopYieldSpotlight from "./TopYieldSpotlight";
import YieldFinder from "./YieldFinder";
import ActionDrawer, { type DrawerActionTab } from "./ActionDrawer";
import LendingActionModal from "./LendingActionModal";
import { buildAttributedGaugeClaimCall } from "@/lib/lending/builder-attribution";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

const STOCK_REFERENCE_PRICES: Record<string, number> = {
  NVDAc: 138.25,
  AAPLc: 232.5,
  TSLAc: 221.8,
  COINc: 184.5,
  MSFTc: 428.1,
  GOOGLc: 182.2,
  METAc: 590.4,
  AMZNc: 198.8,
  MSTRc: 242.0,
  INTCc: 23.4,
  AMDc: 156.3,
  SKHYc: 138.0,
  ORCLc: 176.5,
  NFLXc: 715.0,
  HIMSc: 24.2,
  LLYc: 825.0,
  CBRSc: 38.0,
  PYPLc: 81.2,
  RBLXc: 47.5,
};

interface LendingHubProps {
  app: WalletAppState;
  guestMode?: boolean;
  onRequestConnect?: () => void;
  initialStock?: string;
}

export default function LendingHub({
  app,
  guestMode: _guestMode = false,
  onRequestConnect,
  initialStock,
}: LendingHubProps) {
  const { wallet, connType, showToast } = app;
  const userAddress = wallet?.address ?? null;
  const isConnected = !!userAddress;

  const {
    overview: marketsOverview,
    loading: overviewLoading,
    refresh: refreshOverview,
  } = useMarketsOverview();

  // Level & Navigation state
  const [activeTab, setActiveTab] = useState<LendingViewTab>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const v = params.get("view");
      if (v === "finder" || v === "vaults" || v === "compare" || v === "stocks") {
        return v;
      }
    }
    return "stocks";
  });
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string | null>(initialStock ?? null);

  // Level 2 data
  const [comparison, setComparison] = useState<StockLendingComparison | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  // Level 3 Action Drawer state (stock lending options)
  const [drawerOption, setDrawerOption] = useState<StockLendingOption | null>(null);
  const [drawerInitialTab, setDrawerInitialTab] = useState<DrawerActionTab>("supply");

  // Fallback modal for non-stock markets or gauge deposit/withdraw
  const [selectedMarketModal, setSelectedMarketModal] = useState<LendingMarket | null>(null);
  const [marketModalAction, setMarketModalAction] = useState<
    "supply" | "withdraw" | "borrow" | "repay" | "stake" | "unstake"
  >("supply");

  // Real-time freshness & polling
  const [lastUpdated, setLastUpdated] = useState<number>(() => Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Wallet balances cache for tokenized stocks
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Claim pending state for gauges
  const [_claimingGaugeId, setClaimingGaugeId] = useState<string | null>(null);

  // Discovered markets state from /api/markets, seeded with verified onchain baseline
  const [discoveredMarkets, setDiscoveredMarkets] = useState<import("@/lib/lending/discovery/types").NormalizedMarket[]>(() => getBaselineVerifiedMarkets());
  const [protocolErrors, setProtocolErrors] = useState<Record<string, string>>({});
  const [isLoadingDiscovered, setIsLoadingDiscovered] = useState(false);
  const [showAllStocks, setShowAllStocks] = useState(false);

  const fetchDiscoveredMarkets = useCallback(async (refresh = false, silent = false) => {
    if (!silent) setIsLoadingDiscovered(true);
    try {
      const res = await fetch(`/api/markets?chainId=8453${refresh ? "&refresh=true" : ""}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.markets) && data.markets.length > 0) {
          setDiscoveredMarkets(data.markets);
          if (data.protocolStatus && typeof data.protocolStatus === "object") {
            const errs: Record<string, string> = {};
            for (const [k, v] of Object.entries(data.protocolStatus as Record<string, { status?: string; error?: string }>)) {
              if (v?.status === "error") {
                errs[k] = v.error || "Error";
              }
            }
            setProtocolErrors(errs);
          }
          setLastUpdated(Date.now());
          setSecondsAgo(0);
        }
      }
    } catch (e) {
      console.warn("Discovered markets fetch error:", e);
    } finally {
      if (!silent) setIsLoadingDiscovered(false);
    }
  }, []);

  useEffect(() => {
    void fetchDiscoveredMarkets(false, false);
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void fetchDiscoveredMarkets(false, true);
    }, 20_000);
    return () => clearInterval(interval);
  }, [fetchDiscoveredMarkets]);

  // Seconds ago timer tick
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  // Load comparison data when selectedStockSymbol changes or on refresh
  const loadComparison = useCallback(async (symbol: string, force = false) => {
    setIsLoadingComparison(true);
    try {
      const data = await getUnifiedStockLendingComparison(symbol, undefined, force, discoveredMarkets);
      setComparison(data);
      setLastUpdated(Date.now());
      setSecondsAgo(0);
    } catch (err) {
      console.error("Failed to load comparison for stock:", symbol, err);
    } finally {
      setIsLoadingComparison(false);
    }
  }, [discoveredMarkets]);

  useEffect(() => {
    if (selectedStockSymbol) {
      loadComparison(selectedStockSymbol);
    } else {
      setComparison(null);
    }
  }, [selectedStockSymbol, loadComparison]);

  // Periodic background refresh for active comparison (every 20s)
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedStockSymbol) {
        loadComparison(selectedStockSymbol, true);
      } else {
        setLastUpdated(Date.now());
      }
    }, 20_000);
    return () => clearInterval(interval);
  }, [selectedStockSymbol, loadComparison]);

  // Fetch on-chain balances for prominent stocks if wallet connected
  useEffect(() => {
    if (!userAddress) {
      setWalletBalances({});
      return;
    }
    let alive = true;
    setIsLoadingBalances(true);

    async function fetchBalances() {
      try {
        const pub = createBasePublicClient();
        const user = userAddress as `0x${string}`;

        // Canonical stocks to query balances
        const topStocks = BASE_STOCKS;
        const calls = topStocks.map((stk) =>
          pub
            .readContract({
              address: stk.address,
              abi: [
                {
                  name: "balanceOf",
                  type: "function",
                  stateMutability: "view",
                  inputs: [{ name: "account", type: "address" }],
                  outputs: [{ name: "", type: "uint256" }],
                },
              ],
              functionName: "balanceOf",
              args: [user],
            })
            .catch(() => BigInt(0))
        );

        const results = await Promise.all(calls);
        if (!alive) return;

        const mapping: Record<string, number> = {};
        topStocks.forEach((stk, idx) => {
          const raw = results[idx] ?? BigInt(0);
          const bal = Number(raw) / 10 ** stk.decimals;
          mapping[stk.symbol] = bal;
        });

        setWalletBalances(mapping);
      } catch (err) {
        console.error("Error fetching stock balances:", err);
      } finally {
        if (alive) setIsLoadingBalances(false);
      }
    }

    fetchBalances();
    return () => {
      alive = false;
    };
  }, [userAddress]);

  // 1. Markets Overview (Level 1) Rows Generation - Derived dynamically from unified discovery
  const stockRows: AssetMarketRow[] = useMemo(() => {
    const stockList = showAllStocks ? ALL_BASE_STOCKS : BASE_STOCKS;
    return stockList.map((stk) => {
      const summary = deriveStockMarketOptions(stk, discoveredMarkets);

      const bestSupplyApy = summary.bestOverallYieldOption?.supplyApy ?? 0;
      const bestSupplyProtocol =
        summary.bestOverallYieldOption?.protocolLabel ??
        (summary.hasLendingMarket ? "Collateral only" : "None");
      const supplyKindChip = summary.bestOverallYieldOption?.kindChip;

      const bestBorrowApr = summary.bestBorrowOption?.borrowApr ?? null;
      const bestBorrowProtocol = summary.bestBorrowOption?.protocolLabel ?? null;
      const borrowKindChip = summary.bestBorrowOption ? "Borrow" : undefined;

      const totalLiquidityUsd = summary.totalLiquidityUsd;
      const listedProtocols =
        summary.listedProtocols.length > 0 ? summary.listedProtocols : ["No Pool"];

      const protocolRates: Record<string, ProtocolRateInfo> = {};
      for (const opt of summary.options) {
        if (!protocolRates[opt.protocol]) {
          protocolRates[opt.protocol] = {
            supplyApy: opt.supplyApy,
            borrowApr: opt.borrowApr,
            liquidityUsd: opt.liquidityUsd > 0 ? opt.liquidityUsd : opt.tvlUsd,
            protocolLabel: opt.protocolLabel,
            hasMarket: true,
            borrowLabel: opt.role === "borrow" ? "Stock Collateral" : opt.roleLabel,
            typeLabel: opt.kindChip,
          };
        } else {
          if (opt.supplyApy > protocolRates[opt.protocol].supplyApy) {
            protocolRates[opt.protocol].supplyApy = opt.supplyApy;
          }
          if (
            opt.borrowApr !== null &&
            (protocolRates[opt.protocol].borrowApr === null ||
              opt.borrowApr < (protocolRates[opt.protocol].borrowApr ?? 999))
          ) {
            protocolRates[opt.protocol].borrowApr = opt.borrowApr;
          }
          protocolRates[opt.protocol].liquidityUsd +=
            opt.liquidityUsd > 0 ? opt.liquidityUsd : opt.tvlUsd;
        }
      }

      // Check if newly listed (within last 7 days)
      const isNew = stk.addedAt ? isNewStock(stk.addedAt) : false;

      const riskFlags = Array.from(
        new Set(summary.options.flatMap((o) => o.rawMarket.riskFlags))
      );
      const oracleVerified =
        summary.options.length > 0 ? !riskFlags.includes("UNKNOWN_ORACLE") : false;

      const priceUsd = STOCK_REFERENCE_PRICES[stk.symbol] ?? 125.0;

      const bal = walletBalances[stk.symbol] ?? null;
      const balUsd = bal !== null ? bal * priceUsd : null;

      return {
        symbol: stk.symbol,
        name: stk.name,
        category: stk.category ?? "tech",
        address: stk.address,
        priceUsd,
        priceChange24h: 1.25,
        bestSupplyApy,
        bestSupplyProtocol,
        supplyKindChip,
        bestBorrowApr,
        bestBorrowProtocol,
        borrowKindChip,
        totalLiquidityUsd,
        walletBalance: bal,
        walletBalanceUsd: balUsd,
        isNew,
        listedProtocols,
        hasLendingMarket: summary.hasLendingMarket,
        riskFlags,
        oracleVerified,
        protocolRates,
      };
    });
  }, [discoveredMarkets, walletBalances, showAllStocks]);

  // All Markets Rows (strictly verified tokenized stocks)
  const allMarketsRows: AssetMarketRow[] = useMemo(() => {
    return stockRows;
  }, [stockRows]);

  // 2. Real Staking & Vault Opportunities (Beefy vaults, Aerodrome gauges, Pendle pools)
  const gaugeRows: GaugeRowData[] = useMemo(() => {
    const liveVaults = discoveredMarkets
      .filter(
        (m) =>
          (m.protocol === "beefy" || m.protocol === "aerodrome" || m.protocol === "pendle") &&
          m.status === "active"
      )
      .map((m) => {
        const stockSym = m.collateralAsset?.symbol || m.supplyAsset.symbol;
        return {
          id: m.marketId,
          pairName: m.supplyAsset.name || `${stockSym} Vault`,
          stockSymbol: stockSym,
          category: "equities",
          gaugeApr: m.supplyApy,
          tvlUsd: m.tvlUsd || m.liquidityUsd,
          rewardToken: m.protocol === "beefy" ? "BEEFY" : m.protocol === "pendle" ? "PENDLE" : "AERO",
          stakedAmount: 0,
          stakedUsd: 0,
          pendingRewards: 0,
          pendingRewardsUsd: 0,
          contractAddress: (m.contractAddress || m.supplyAsset.address) as `0x${string}`,
        };
      });

    return liveVaults;
  }, [discoveredMarkets]);

  // 3. Live Stats Calculations for Header
  const headerStats = useMemo(() => {
    let topSupply = 0;
    let lowestBorrow = 999;
    let totalLiquidity = 0;

    allMarketsRows.forEach((r) => {
      if (r.hasLendingMarket) {
        if (r.bestSupplyApy > topSupply) topSupply = r.bestSupplyApy;
        if (r.bestBorrowApr && r.bestBorrowApr > 0 && r.bestBorrowApr < lowestBorrow) {
          lowestBorrow = r.bestBorrowApr;
        }
        totalLiquidity += r.totalLiquidityUsd;
      }
    });

    const verifiedPools = discoveredMarkets.filter(
      (m) => (m.liquidityUsd > 0 ? m.liquidityUsd : (m.tvlUsd || 0)) >= MIN_TVL_USD
    ).length;

    return {
      topSupplyApy: topSupply > 0 ? topSupply : 0,
      lowestBorrowApr: lowestBorrow < 999 ? lowestBorrow : 0,
      totalLiquidityUsd: totalLiquidity,
      verifiedPoolsCount: verifiedPools > 0 ? verifiedPools : discoveredMarkets.length,
    };
  }, [allMarketsRows, discoveredMarkets]);

  // 4. Real On-chain User Positions
  const [userPositions, setUserPositions] = useState<UserProtocolPosition[]>([]);
  const [positionsErrors, setPositionsErrors] = useState<Record<string, string>>({});
  const [isLoadingPositions, setIsLoadingPositions] = useState<boolean>(false);
  const [isRefreshingPositions, setIsRefreshingPositions] = useState<boolean>(false);
  const [lastPositionsUpdated, setLastPositionsUpdated] = useState<number>(() => Date.now());
  const [positionsSecondsAgo, setPositionsSecondsAgo] = useState<number>(0);
  const [isMockPositionsData, setIsMockPositionsData] = useState<boolean>(false);
  const [isWrongNetwork, setIsWrongNetwork] = useState<boolean>(false);

  // Check if wallet is on Base (8453 / 0x2105)
  useEffect(() => {
    if (!isConnected || typeof window === "undefined") {
      setIsWrongNetwork(false);
      return;
    }
    let alive = true;
    async function checkChain() {
      try {
        const providerType = (connType ?? "injected") as "farcaster" | "baseAccount" | "coinbase" | "metamask" | "injected";
        const provider = (await getEip1193Provider(providerType)) as {
          request: (args: { method: string }) => Promise<unknown>;
        } | null;
        if (provider?.request) {
          const chainId = (await provider.request({ method: "eth_chainId" })) as string;
          const normalized = chainId?.toLowerCase();
          if (alive) {
            setIsWrongNetwork(Boolean(normalized && normalized !== "0x2105" && normalized !== "8453"));
          }
        }
      } catch {
        if (alive) setIsWrongNetwork(false);
      }
    }
    void checkChain();
    return () => {
      alive = false;
    };
  }, [isConnected, connType]);

  const handleSwitchNetwork = async () => {
    try {
      const providerType = (connType ?? "injected") as "farcaster" | "baseAccount" | "coinbase" | "metamask" | "injected";
      const provider = (await getEip1193Provider(providerType)) as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      } | null;
      if (provider) {
        await ensureBaseNetwork(provider);
        setIsWrongNetwork(false);
        if (userAddress) {
          void loadUserPositions(userAddress, true);
        }
      }
    } catch (e) {
      console.error("Failed to switch to Base network:", e);
    }
  };

  // Master positions reader
  const loadUserPositions = useCallback(async (addr: string, isManual = false) => {
    if (isManual) setIsRefreshingPositions(true);
    else setIsLoadingPositions(true);

    try {
      const res = await fetchAllUserPositions(addr as `0x${string}`);
      setUserPositions(res.positions);
      setPositionsErrors(res.errors);
      setIsMockPositionsData(res.isMockData);
      setLastPositionsUpdated(Date.now());
    } catch (err: unknown) {
      console.error("Failed to read user positions:", err);
      setUserPositions([]);
      setPositionsErrors({ Base: "Failed to connect to Base RPC" });
    } finally {
      setIsLoadingPositions(false);
      setIsRefreshingPositions(false);
    }
  }, []);

  // Manual refresh handler for header and asset detail view
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchDiscoveredMarkets(true, false);
      if (selectedStockSymbol) {
        await loadComparison(selectedStockSymbol, true);
      }
      if (userAddress) {
        void loadUserPositions(userAddress, true);
      }
      setLastUpdated(Date.now());
      setSecondsAgo(0);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  }, [fetchDiscoveredMarkets, selectedStockSymbol, loadComparison, userAddress, loadUserPositions]);

  // Invalidate and clear immediately on disconnect or account switch
  useEffect(() => {
    if (!userAddress) {
      setUserPositions([]);
      setPositionsErrors({});
      setIsLoadingPositions(false);
      setIsMockPositionsData(false);
      return;
    }
    void loadUserPositions(userAddress);
  }, [userAddress, loadUserPositions]);

  // Polling every 30s while document is visible
  useEffect(() => {
    if (!userAddress) return;
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void loadUserPositions(userAddress, true);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [userAddress, loadUserPositions]);

  // Live timer for 'Xs ago'
  useEffect(() => {
    const t = setInterval(() => {
      setPositionsSecondsAgo(Math.floor((Date.now() - lastPositionsUpdated) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [lastPositionsUpdated]);

  const handleRetryProtocol = async (protocol: string) => {
    if (!userAddress) return;
    setIsRefreshingPositions(true);
    try {
      let retryPositions: UserProtocolPosition[] = [];
      if (protocol.toLowerCase().includes("beefy")) {
        retryPositions = await readBeefyPositions(userAddress as `0x${string}`);
      } else if (protocol.toLowerCase().includes("aave")) {
        retryPositions = await readAavePositions(userAddress as `0x${string}`);
      } else if (protocol.toLowerCase().includes("ipor")) {
        retryPositions = await readIporPositions(userAddress as `0x${string}`);
      } else if (protocol.toLowerCase().includes("aerodrome")) {
        retryPositions = await readAerodromeGaugePositions(userAddress as `0x${string}`);
      }
      setUserPositions((prev) => [
        ...prev.filter((p) => !p.protocolName.toLowerCase().includes(protocol.toLowerCase())),
        ...retryPositions,
      ]);
      setPositionsErrors((prev) => {
        const copy = { ...prev };
        delete copy[protocol];
        return copy;
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Retry failed";
      setPositionsErrors((prev) => ({ ...prev, [protocol]: msg }));
    } finally {
      setIsRefreshingPositions(false);
    }
  };

  // Open Level 3 Action Drawer for Stock Option
  const handleOpenStockDrawer = (option: StockLendingOption, tab: DrawerActionTab) => {
    setDrawerOption(option);
    setDrawerInitialTab(tab);
  };

  // Open Action Modal for non-stock markets or gauges
  const handleOpenMarketModal = (
    market: LendingMarket,
    action: "supply" | "withdraw" | "borrow" | "repay" | "stake" | "unstake"
  ) => {
    setSelectedMarketModal(market);
    setMarketModalAction(action);
  };

  // Handle Explore Vault click from YieldCalculator
  const handleExploreYieldOption = async (option: {
    protocol: string;
    stockSymbol?: string;
    contractAddress?: string;
    marketId?: string;
  }) => {
    const sym = option.stockSymbol || "NVDAc";
    setSelectedStockSymbol(sym);

    // 1. Direct match in BASE_LENDING_MARKETS (Beefy, Morpho, Moonwell, Aerodrome)
    const matchedMarket =
      BASE_LENDING_MARKETS.find(
        (m) =>
          (option.marketId && m.id === option.marketId) ||
          (option.contractAddress &&
            m.contractAddress?.toLowerCase() === option.contractAddress.toLowerCase()) ||
          (m.protocol.toLowerCase() === option.protocol.toLowerCase() &&
            (!option.stockSymbol || m.asset.symbol.toLowerCase().includes(sym.toLowerCase())))
      ) ||
      BASE_LENDING_MARKETS.find(
        (m) => m.protocol.toLowerCase() === option.protocol.toLowerCase()
      );

    if (matchedMarket) {
      const isStake =
        matchedMarket.category === "stocks_stake" ||
        matchedMarket.contractType === "aerodrome_gauge";
      handleOpenMarketModal(matchedMarket, isStake ? "stake" : "supply");
      return;
    }

    // 2. Aerodrome / Staking Gauge match in gaugeRows
    const gaugeMatch = gaugeRows.find(
      (g) =>
        (option.marketId && g.id === option.marketId) ||
        (option.contractAddress &&
          g.contractAddress?.toLowerCase() === option.contractAddress.toLowerCase()) ||
        g.stockSymbol?.toLowerCase() === sym.toLowerCase()
    );

    if (gaugeMatch) {
      setActiveTab("vaults");
      const isBeefyGauge = gaugeMatch.rewardToken === "BEEFY" || gaugeMatch.id.includes("beefy");
      const gaugeMarket: LendingMarket = {
        id: gaugeMatch.id,
        name: `${gaugeMatch.pairName} ${isBeefyGauge ? "Auto-Vault" : "Staking Gauge"}`,
        protocol: isBeefyGauge ? "beefy" : "aerodrome",
        protocolLabel: isBeefyGauge ? "Beefy Finance" : "Aerodrome Finance",
        protocolBadge: isBeefyGauge ? "Auto-Compounder" : "Slipstream Gauge",
        protocolAddress: gaugeMatch.contractAddress,
        protocolUrl: isBeefyGauge
          ? `https://app.beefy.com/vault/${gaugeMatch.id.replace(/^beefy-/, "")}`
          : "https://aerodrome.finance/pools",
        category: "stocks_stake",
        asset: {
          symbol: gaugeMatch.pairName,
          name: gaugeMatch.pairName,
          address: gaugeMatch.contractAddress,
          decimals: 18,
          isStock: true,
        },
        supplyApy: gaugeMatch.gaugeApr,
        stakingApr: gaugeMatch.gaugeApr,
        tvlUsd: gaugeMatch.tvlUsd,
        oracle: isBeefyGauge ? "Beefy Onchain Vault" : "Aerodrome TWAP",
        contractAddress: gaugeMatch.contractAddress,
        contractType: isBeefyGauge ? "beefy_vault" : "aerodrome_gauge",
        builderAttributed: true,
        isStockFocus: true,
      };
      handleOpenMarketModal(gaugeMarket, isBeefyGauge ? "supply" : "stake");
      return;
    }

    // 3. Try to load options for Level 3 drawer
    try {
      setActiveTab("stocks");
      const res = await getUnifiedStockLendingComparison(sym, undefined, false, discoveredMarkets);
      setComparison(res);

      const matchedOption =
        res.options.find(
          (opt) =>
            opt.protocol.toLowerCase().includes(option.protocol.toLowerCase()) ||
            option.protocol.toLowerCase().includes(opt.protocol.toLowerCase())
        ) ||
        res.bestSupplyOption ||
        res.options[0];

      if (matchedOption) {
        handleOpenStockDrawer(matchedOption, "supply");
        return;
      }
    } catch (e) {
      console.warn("Failed to load options for yield calculator selection:", e);
    }

    // 4. Default fallback: Search in BASE_LENDING_MARKETS
    const fallbackMarket =
      BASE_LENDING_MARKETS.find(
        (m) =>
          (option.marketId && m.id === option.marketId) ||
          (option.contractAddress &&
            m.contractAddress?.toLowerCase() === option.contractAddress.toLowerCase()) ||
          m.protocol.toLowerCase() === option.protocol.toLowerCase()
      ) || BASE_LENDING_MARKETS[0];

    if (fallbackMarket) {
      handleOpenMarketModal(fallbackMarket, "supply");
    }
  };

  // Handle Gauge Claim directly
  const handleClaimGauge = async (gauge: GaugeRowData) => {
    if (!userAddress) {
      if (onRequestConnect) onRequestConnect();
      return;
    }

    setClaimingGaugeId(gauge.id);
    try {
      const claimCall = buildAttributedGaugeClaimCall(
        gauge.contractAddress,
        userAddress as `0x${string}`
      );
      const hash = await sendAppTransactions(
        connType ?? "injected",
        userAddress,
        [claimCall]
      );

      if (hash) {
        showToast(
          `Claimed AERO rewards for ${gauge.pairName}!`,
          `Transaction: ${hash.slice(0, 10)}...`
        );
        void loadUserPositions(userAddress, true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to claim rewards";
      showToast("Claim transaction failed", msg);
    } finally {
      setClaimingGaugeId(null);
    }
  };

  // Current stock wallet balance for AssetDetailView
  const currentStockBalance = selectedStockSymbol ? walletBalances[selectedStockSymbol] ?? null : null;
  const currentStockBalanceUsd =
    selectedStockSymbol && currentStockBalance !== null && comparison
      ? currentStockBalance * comparison.navUsd
      : null;

  return (
    <div className="space-y-6 pb-16 animate-meridian-rise">
      {/* 0. BASE MARKETS OVERVIEW STRIP (24h Volume, Total Supplied, Total Borrowed, 1M/3M/All Chart) */}
      <MarketsOverviewStrip
        overview={marketsOverview}
        loading={overviewLoading}
        onRefresh={refreshOverview}
      />

      {/* 1. COMPACT HEADER WITH LIVE STATS & DISCLAIMER */}
      <LendingHeader
        topSupplyApy={headerStats.topSupplyApy}
        lowestBorrowApr={headerStats.lowestBorrowApr}
        totalLiquidityUsd={headerStats.totalLiquidityUsd}
        verifiedPoolsCount={headerStats.verifiedPoolsCount}
        lastUpdatedSecondsAgo={secondsAgo}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      {/* 2. YOUR POSITIONS & HEALTH (Real on-chain positions) */}
      <PositionsPanel
        isConnected={isConnected}
        isWrongNetwork={isWrongNetwork}
        onSwitchNetwork={handleSwitchNetwork}
        isLoading={isLoadingPositions}
        positions={userPositions}
        errors={positionsErrors}
        onRetryProtocol={handleRetryProtocol}
        onRefresh={() => {
          if (userAddress) void loadUserPositions(userAddress, true);
        }}
        isRefreshing={isRefreshingPositions}
        lastUpdatedSecondsAgo={positionsSecondsAgo}
        onRequestConnect={onRequestConnect}
        isMockData={isMockPositionsData}
        onOpenAction={(marketId, action) => {
          // Check if it's a gauge action
          const gaugeMatch = gaugeRows.find(
            (g) => g.id === marketId || g.contractAddress === marketId
          );
          if (gaugeMatch) {
            const market = BASE_LENDING_MARKETS.find(
              (m) => m.contractAddress === gaugeMatch.contractAddress
            ) ?? {
              id: gaugeMatch.id,
              name: `${gaugeMatch.pairName} Gauge`,
              protocol: "aerodrome",
              protocolLabel: "Aerodrome Finance",
              protocolBadge: "Slipstream Gauge",
              protocolAddress: gaugeMatch.contractAddress,
              protocolUrl: "https://aerodrome.finance",
              category: "stocks_stake",
              asset: {
                symbol: gaugeMatch.pairName,
                name: gaugeMatch.pairName,
                address: gaugeMatch.contractAddress,
                decimals: 18,
              },
              supplyApy: gaugeMatch.gaugeApr,
              stakingApr: gaugeMatch.gaugeApr,
              tvlUsd: gaugeMatch.tvlUsd,
              oracle: "Aerodrome TWAP",
              contractAddress: gaugeMatch.contractAddress,
              contractType: "aerodrome_gauge",
              builderAttributed: true,
              isStockFocus: true,
            };
            handleOpenMarketModal(
              market,
              action === "supply" ? "stake" : action === "withdraw" ? "unstake" : "stake"
            );
            return;
          }

          // Stock or lending market
          const pos = userPositions.find((p) => p.marketId === marketId || p.id === marketId);
          const sym = pos ? pos.assetSymbol : marketId.replace(/^pos-/, "");

          if (comparison && comparison.stockSymbol === sym && comparison.bestSupplyOption) {
            const opt =
              (action === "borrow" || action === "repay") && comparison.bestBorrowOption
                ? comparison.bestBorrowOption
                : comparison.bestSupplyOption;
            handleOpenStockDrawer(
              opt,
              action === "stake" || action === "unstake" ? "supply" : action
            );
          } else {
            getUnifiedStockLendingComparison(sym, undefined, false, discoveredMarkets)
              .then((res) => {
                setComparison(res);
                const opt =
                  (action === "borrow" || action === "repay") && res.bestBorrowOption
                    ? res.bestBorrowOption
                    : (res.bestSupplyOption ?? res.options[0]);
                if (opt) {
                  handleOpenStockDrawer(
                    opt,
                    action === "stake" || action === "unstake" ? "supply" : action
                  );
                }
              })
              .catch((e) => {
                console.error("Failed to load position option:", e);
              });
          }
        }}
      />

      {/* Top Yield Spotlight: Highlights top verified yield opportunity with zero calculation clutter */}
      <TopYieldSpotlight
        markets={discoveredMarkets}
        gaugeRows={gaugeRows}
        stockRows={stockRows}
        onExploreVault={handleExploreYieldOption}
        onSelectOption={(protocol) => {
          handleExploreYieldOption({ protocol });
        }}
      />

      {/* 4. UNIFIED WORKSPACE NAVIGATION (Directly controlling showcase view below) */}
      <div id="lending-view-tabs" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <LendingViewTabs
          value={activeTab}
          onChange={(newTab) => {
            setActiveTab(newTab);
            setSelectedStockSymbol(null);
          }}
          stocksCount={BASE_STOCKS.length}
          vaultsCount={gaugeRows.length}
        />
      </div>

      {/* 5. ACTIVE SHOWCASE VIEW */}
      {activeTab === "vaults" ? (
        /* STAKE & GAUGES VIEW */
        <GaugesTable
          gauges={gaugeRows}
          isConnected={isConnected}
          onRequestConnect={onRequestConnect}
          onOpenStake={(g) => {
            const market = BASE_LENDING_MARKETS.find((m) => m.contractAddress === g.contractAddress) ?? {
              id: g.id,
              name: `Stake ${g.pairName} Gauge`,
              protocol: "aerodrome",
              protocolLabel: "Aerodrome Finance",
              protocolBadge: "Slipstream Gauge",
              protocolAddress: g.contractAddress,
              protocolUrl: "https://aerodrome.finance",
              category: "stocks_stake",
              asset: { symbol: g.pairName, name: g.pairName, address: g.contractAddress, decimals: 18 },
              supplyApy: g.gaugeApr,
              stakingApr: g.gaugeApr,
              tvlUsd: g.tvlUsd,
              oracle: "Aerodrome TWAP",
              contractAddress: g.contractAddress,
              contractType: "aerodrome_gauge",
              builderAttributed: true,
              isStockFocus: true,
            };
            handleOpenMarketModal(market, "stake");
          }}
          onOpenUnstake={(g) => {
            const market = BASE_LENDING_MARKETS.find((m) => m.contractAddress === g.contractAddress) ?? {
              id: g.id,
              name: `Unstake ${g.pairName} Gauge`,
              protocol: "aerodrome",
              protocolLabel: "Aerodrome Finance",
              protocolBadge: "Slipstream Gauge",
              protocolAddress: g.contractAddress,
              protocolUrl: "https://aerodrome.finance",
              category: "stocks_stake",
              asset: { symbol: g.pairName, name: g.pairName, address: g.contractAddress, decimals: 18 },
              supplyApy: g.gaugeApr,
              stakingApr: g.gaugeApr,
              tvlUsd: g.tvlUsd,
              oracle: "Aerodrome TWAP",
              contractAddress: g.contractAddress,
              contractType: "aerodrome_gauge",
              builderAttributed: true,
              isStockFocus: true,
            };
            handleOpenMarketModal(market, "unstake");
          }}
          onClaim={handleClaimGauge}
        />
      ) : activeTab === "finder" ? (
        /* MULTI-PROTOCOL YIELD SCANNER */
        <YieldFinder
          markets={discoveredMarkets}
          gaugeRows={gaugeRows}
          stockRows={stockRows}
          isConnected={isConnected}
          onRequestConnect={onRequestConnect}
          onSelectPool={(pool) => {
            handleExploreYieldOption({
              protocol: pool.protocol,
              marketId: pool.id,
              stockSymbol: pool.assetSymbol,
            });
          }}
        />
      ) : activeTab === "compare" ? (
        /* REAL MULTI-PROTOCOL TOKENIZED STOCKS COMPARISON TOOL */
        <ProtocolCompareHub
          onSelectStock={(symbol) => {
            setActiveTab("stocks");
            setSelectedStockSymbol(symbol);
          }}
          onRequestConnect={onRequestConnect}
        />
      ) : selectedStockSymbol && comparison ? (
        /* LEVEL 2: ASSET DETAIL VIEW */
        <AssetDetailView
          comparison={comparison}
          onBack={() => setSelectedStockSymbol(null)}
          isConnected={isConnected}
          onRequestConnect={onRequestConnect}
          walletBalance={currentStockBalance}
          walletBalanceUsd={currentStockBalanceUsd}
          onOpenSupply={(opt) => handleOpenStockDrawer(opt, "supply")}
          onOpenBorrow={(opt) => handleOpenStockDrawer(opt, "borrow")}
          onOpenDetails={(opt) => handleOpenStockDrawer(opt, "supply")}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing || isLoadingComparison}
        />
      ) : (
        /* LEVEL 1: MARKETS OVERVIEW (Sortable Virtualized Table) */
        <MarketsTable
          rows={allMarketsRows}
          selectedSymbol={selectedStockSymbol}
          onSelectAsset={(symbol) => setSelectedStockSymbol(symbol)}
          isConnected={isConnected}
          onRequestConnect={onRequestConnect}
          loading={isLoadingBalances || isLoadingDiscovered}
          showAllStocks={showAllStocks}
          onToggleShowAllStocks={setShowAllStocks}
          protocolErrors={protocolErrors}
          onRetryProtocol={() => fetchDiscoveredMarkets(true)}
          secondsAgo={secondsAgo}
        />
      )}

      {/* 5. LEVEL 3: ACTION DRAWER (Stock Lending & Borrowing) */}
      {drawerOption && (
        <ActionDrawer
          isOpen={!!drawerOption}
          onClose={() => setDrawerOption(null)}
          option={drawerOption}
          initialTab={drawerInitialTab}
          userAddress={userAddress}
          connType={connType}
          onRequestConnect={onRequestConnect}
          onSuccess={() => {
            showToast("Transaction executed successfully!", "Attributed with Base Builder Code");
            void fetchDiscoveredMarkets(true, true);
            if (selectedStockSymbol) {
              loadComparison(selectedStockSymbol, true);
            }
            if (userAddress) {
              void loadUserPositions(userAddress, true);
            }
          }}
        />
      )}

      {/* 6. GENERAL / GAUGE MARKET ACTION MODAL */}
      {selectedMarketModal && (
        <LendingActionModal
          market={selectedMarketModal}
          initialAction={marketModalAction}
          userAddress={userAddress}
          connType={connType}
          onClose={() => setSelectedMarketModal(null)}
          onRequestConnect={onRequestConnect}
          onSuccess={() => {
            showToast("Market transaction confirmed!", "Attributed with Base Builder Code");
            void fetchDiscoveredMarkets(true, true);
            if (selectedStockSymbol) {
              loadComparison(selectedStockSymbol, true);
            }
            if (userAddress) {
              void loadUserPositions(userAddress, true);
            }
          }}
        />
      )}
    </div>
  );
}
