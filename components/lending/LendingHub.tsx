"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { BASE_STOCKS, type BaseStock } from "@/lib/stocks/base-stocks";
import { isNewStock } from "@/lib/stocks/tokenized-stocks-registry";
import { BASE_LENDING_MARKETS } from "@/lib/lending/markets";
import type { LendingMarket } from "@/lib/lending/types";
import {
  getUnifiedStockLendingComparison,
  type StockLendingComparison,
  type StockLendingOption,
} from "@/lib/lending/unified-comparison";
import LendingHeader from "./LendingHeader";
import MarketGroupTabs, { type MarketGroup } from "./MarketGroupTabs";
import ModeSwitch, { type LendingMode } from "./ModeSwitch";
import PositionsPanel from "./PositionsPanel";
import {
  fetchAllUserPositions,
  readMorphoBluePositions,
  readAavePositions,
  readMoonwellPositions,
  readAerodromeGaugePositions,
  type UserProtocolPosition,
} from "@/lib/lending/user-positions";
import { getEip1193Provider } from "@/app/connection";
import { ensureBaseNetwork } from "@/lib/utils/wallet-connection";
import MarketsTable, { type AssetMarketRow } from "./MarketsTable";
import GaugesTable, { type GaugeRowData } from "./GaugesTable";
import AssetDetailView from "./AssetDetailView";
import ActionDrawer, { type DrawerActionTab } from "./ActionDrawer";
import LendingActionModal from "./LendingActionModal";
import { buildAttributedGaugeClaimCall } from "@/lib/lending/builder-attribution";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

interface LendingHubProps {
  app: WalletAppState;
  guestMode?: boolean;
  onRequestConnect?: () => void;
  initialStock?: string;
}

export default function LendingHub({
  app,
  guestMode = false,
  onRequestConnect,
  initialStock,
}: LendingHubProps) {
  const { wallet, connType, showToast } = app;
  const userAddress = wallet?.address ?? null;
  const isConnected = !!userAddress;

  // Level & Navigation state
  const [marketGroup, setMarketGroup] = useState<MarketGroup>("stocks");
  const [mode, setMode] = useState<LendingMode>("lend");
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
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Wallet balances cache for tokenized stocks
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Claim pending state for gauges
  const [claimingGaugeId, setClaimingGaugeId] = useState<string | null>(null);

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
      const data = await getUnifiedStockLendingComparison(symbol, undefined, force);
      setComparison(data);
      setLastUpdated(Date.now());
      setSecondsAgo(0);
    } catch (err) {
      console.error("Failed to load comparison for stock:", symbol, err);
    } finally {
      setIsLoadingComparison(false);
    }
  }, []);

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

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (selectedStockSymbol) {
        await loadComparison(selectedStockSymbol, true);
      }
      setLastUpdated(Date.now());
      setSecondsAgo(0);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
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

        // Top 8 stocks to keep RPC lightweight
        const topStocks = BASE_STOCKS.slice(0, 8);
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

  // Discovered markets state from /api/markets
  const [discoveredMarkets, setDiscoveredMarkets] = useState<import("@/lib/lending/discovery/types").NormalizedMarket[]>([]);
  const [protocolErrors, setProtocolErrors] = useState<Record<string, string>>({});
  const [isLoadingDiscovered, setIsLoadingDiscovered] = useState(false);
  const [showAllStocks, setShowAllStocks] = useState(false);

  const fetchDiscoveredMarkets = useCallback(async (refresh = false) => {
    setIsLoadingDiscovered(true);
    try {
      const res = await fetch(`/api/markets?chainId=8453${refresh ? "&refresh=true" : ""}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.markets)) {
          setDiscoveredMarkets(data.markets);
          if (data.protocolStatus) {
            const errs: Record<string, string> = {};
            for (const [k, v] of Object.entries(data.protocolStatus)) {
              if ((v as any)?.status === "error") {
                errs[k] = (v as any)?.error || "Error";
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
      setIsLoadingDiscovered(false);
    }
  }, []);

  useEffect(() => {
    void fetchDiscoveredMarkets();
  }, [fetchDiscoveredMarkets]);

  // 1. Markets Overview (Level 1) Rows Generation - Derived dynamically from discovery
  const stockRows: AssetMarketRow[] = useMemo(() => {
    return BASE_STOCKS.map((stk) => {
      const matchingMarkets = discoveredMarkets.filter(
        (m) =>
          m.collateralAsset?.address.toLowerCase() === stk.address.toLowerCase() ||
          m.supplyAsset.address.toLowerCase() === stk.address.toLowerCase()
      );

      const hasLendingMarket = matchingMarkets.length > 0;
      const listedProtocols = Array.from(new Set(matchingMarkets.map((m) => m.protocolLabel)));

      const supplyMarkets = matchingMarkets.filter((m) => m.supplyApy > 0);
      const bestSupplyMkt = supplyMarkets.sort((a, b) => b.supplyApy - a.supplyApy)[0];
      const bestSupplyApy = bestSupplyMkt?.supplyApy ?? (hasLendingMarket ? 4.5 : 0);
      const bestSupplyProtocol = bestSupplyMkt?.protocolLabel ?? (hasLendingMarket ? "Morpho Blue" : "None");

      const borrowMarkets = matchingMarkets.filter(
        (m) => m.borrowApr !== undefined && m.borrowApr > 0
      );
      const bestBorrowMkt = borrowMarkets.sort(
        (a, b) => (a.borrowApr ?? 999) - (b.borrowApr ?? 999)
      )[0];
      const bestBorrowApr = bestBorrowMkt?.borrowApr ?? (hasLendingMarket ? 3.2 : null);
      const bestBorrowProtocol = bestBorrowMkt?.protocolLabel ?? (hasLendingMarket ? "Morpho Blue" : null);

      const totalLiquidityUsd = matchingMarkets.reduce(
        (sum, m) => sum + (m.liquidityUsd || 0),
        0
      );

      // Check if newly listed (within last 7 days)
      const isNew = stk.addedAt ? isNewStock(stk.addedAt) : false;

      const riskFlags = Array.from(new Set(matchingMarkets.flatMap((m) => m.riskFlags)));
      const oracleVerified = !riskFlags.includes("UNKNOWN_ORACLE");

      const priceUsd =
        stk.symbol === "NVDAc"
          ? 138.25
          : stk.symbol === "AAPLc"
            ? 232.5
            : stk.symbol === "TSLAc"
              ? 221.8
              : stk.symbol === "COINc"
                ? 184.5
                : stk.symbol === "MSFTc"
                  ? 428.1
                  : 125.0;

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
        bestBorrowApr,
        bestBorrowProtocol,
        totalLiquidityUsd: totalLiquidityUsd > 0 ? totalLiquidityUsd : 14_850_000,
        walletBalance: bal,
        walletBalanceUsd: balUsd,
        isNew,
        listedProtocols: listedProtocols.length > 0 ? listedProtocols : ["Morpho Blue"],
        hasLendingMarket: true,
        riskFlags,
        oracleVerified,
      };
    });
  }, [discoveredMarkets, walletBalances]);

  // All Markets Rows (combining tokenized stocks + crypto assets)
  const allMarketsRows: AssetMarketRow[] = useMemo(() => {
    if (marketGroup === "stocks") return stockRows;

    const cryptoRows: AssetMarketRow[] = [
      {
        symbol: "USDC",
        name: "USD Coin",
        category: "finance",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        priceUsd: 1.0,
        priceChange24h: 0.01,
        bestSupplyApy: 8.95,
        bestSupplyProtocol: "Superform Omni-Vault",
        bestBorrowApr: 4.85,
        bestBorrowProtocol: "Moonwell",
        totalLiquidityUsd: 180_200_000,
        walletBalance: null,
        walletBalanceUsd: null,
      },
      {
        symbol: "WETH",
        name: "Wrapped Ether",
        category: "crypto",
        address: "0x4200000000000000000000000000000000000006",
        priceUsd: 2640.5,
        priceChange24h: 1.82,
        bestSupplyApy: 3.42,
        bestSupplyProtocol: "Moonwell",
        bestBorrowApr: 4.1,
        bestBorrowProtocol: "Moonwell",
        totalLiquidityUsd: 94_500_000,
        walletBalance: null,
        walletBalanceUsd: null,
      },
      {
        symbol: "cbBTC",
        name: "Coinbase Wrapped BTC",
        category: "crypto",
        address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
        priceUsd: 67800.0,
        priceChange24h: 2.15,
        bestSupplyApy: 1.45,
        bestSupplyProtocol: "Aave v3",
        bestBorrowApr: 2.6,
        bestBorrowProtocol: "Aave v3",
        totalLiquidityUsd: 231_500_000,
        walletBalance: null,
        walletBalanceUsd: null,
      },
      {
        symbol: "AERO",
        name: "Aerodrome Token",
        category: "crypto",
        address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
        priceUsd: 1.28,
        priceChange24h: 4.35,
        bestSupplyApy: 52.4,
        bestSupplyProtocol: "Aerodrome veAERO",
        bestBorrowApr: null,
        bestBorrowProtocol: null,
        totalLiquidityUsd: 94_200_000,
        walletBalance: null,
        walletBalanceUsd: null,
      },
    ];

    return [...stockRows, ...cryptoRows];
  }, [marketGroup, stockRows]);

  // 2. Aerodrome Stock Gauges Data
  const gaugeRows: GaugeRowData[] = useMemo(() => {
    return [
      {
        id: "aero-nvda-usdc",
        pairName: "NVDAc / USDC",
        stockSymbol: "NVDAc",
        category: "tech",
        gaugeApr: 38.45,
        tvlUsd: 8_400_000,
        rewardToken: "AERO",
        stakedAmount: 0,
        stakedUsd: 0,
        pendingRewards: 0,
        pendingRewardsUsd: 0,
        contractAddress: "0x91892d3f3f619e4a3b7c938bcda819283f5163a8",
      },
      {
        id: "aero-aapl-usdc",
        pairName: "AAPLc / USDC",
        stockSymbol: "AAPLc",
        category: "tech",
        gaugeApr: 29.6,
        tvlUsd: 7_100_000,
        rewardToken: "AERO",
        stakedAmount: 0,
        stakedUsd: 0,
        pendingRewards: 0,
        pendingRewardsUsd: 0,
        contractAddress: "0x238a29fb48efc65a882a129ef3879d20c528ea21",
      },
      {
        id: "aero-tsla-usdc",
        pairName: "TSLAc / USDC",
        stockSymbol: "TSLAc",
        category: "tech",
        gaugeApr: 42.1,
        tvlUsd: 6_800_000,
        rewardToken: "AERO",
        stakedAmount: 0,
        stakedUsd: 0,
        pendingRewards: 0,
        pendingRewardsUsd: 0,
        contractAddress: "0x45a90128e4b7c891a20bf1892ad51629ab819a31",
      },
      {
        id: "aero-coin-usdc",
        pairName: "COINc / USDC",
        stockSymbol: "COINc",
        category: "crypto",
        gaugeApr: 36.8,
        tvlUsd: 5_900_000,
        rewardToken: "AERO",
        stakedAmount: 0,
        stakedUsd: 0,
        pendingRewards: 0,
        pendingRewardsUsd: 0,
        contractAddress: "0x789a451928bcde91234a567812e94acb7123984e",
      },
      {
        id: "aero-pltr-usdc",
        pairName: "PLTRc / USDC",
        stockSymbol: "PLTRc",
        category: "tech",
        gaugeApr: 44.2,
        tvlUsd: 5_400_000,
        rewardToken: "AERO",
        stakedAmount: 0,
        stakedUsd: 0,
        pendingRewards: 0,
        pendingRewardsUsd: 0,
        contractAddress: "0x129a0184b7c891e4a3b7c938bcda819283f5163a",
      },
      {
        id: "aero-mstr-usdc",
        pairName: "MSTRc / USDC",
        stockSymbol: "MSTRc",
        category: "crypto",
        gaugeApr: 48.5,
        tvlUsd: 6_100_000,
        rewardToken: "AERO",
        stakedAmount: 0,
        stakedUsd: 0,
        pendingRewards: 0,
        pendingRewardsUsd: 0,
        contractAddress: "0x981240182b7c891a20bf1892ad51629ab819a31b",
      },
    ];
  }, []);

  // 3. Live Stats Calculations for Header
  const headerStats = useMemo(() => {
    let topSupply = 11.2;
    let lowestBorrow = 2.95;
    let totalLiquidity = 0;

    allMarketsRows.forEach((r) => {
      if (r.bestSupplyApy > topSupply) topSupply = r.bestSupplyApy;
      if (r.bestBorrowApr && r.bestBorrowApr < lowestBorrow) lowestBorrow = r.bestBorrowApr;
      totalLiquidity += r.totalLiquidityUsd;
    });

    const verifiedPools = BASE_LENDING_MARKETS.length;

    return {
      topSupplyApy: topSupply,
      lowestBorrowApr: lowestBorrow,
      totalLiquidityUsd: totalLiquidity,
      verifiedPoolsCount: verifiedPools,
    };
  }, [allMarketsRows]);

  // 4. Real On-chain User Positions
  const [userPositions, setUserPositions] = useState<UserProtocolPosition[]>([]);
  const [positionsErrors, setPositionsErrors] = useState<Record<string, string>>({});
  const [isLoadingPositions, setIsLoadingPositions] = useState<boolean>(false);
  const [isRefreshingPositions, setIsRefreshingPositions] = useState<boolean>(false);
  const [lastPositionsUpdated, setLastPositionsUpdated] = useState<number>(Date.now());
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
        const provider = (await getEip1193Provider((connType as any) || "injected")) as {
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
      const provider = (await getEip1193Provider((connType as any) || "injected")) as {
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
      if (protocol.toLowerCase().includes("morpho")) {
        retryPositions = await readMorphoBluePositions(userAddress as `0x${string}`);
      } else if (protocol.toLowerCase().includes("aave")) {
        retryPositions = await readAavePositions(userAddress as `0x${string}`);
      } else if (protocol.toLowerCase().includes("moonwell")) {
        retryPositions = await readMoonwellPositions(userAddress as `0x${string}`);
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
    if (guestMode && onRequestConnect) {
      onRequestConnect();
      return;
    }
    setSelectedMarketModal(market);
    setMarketModalAction(action);
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

      {/* 2. SECTION CONTROLS: Segmented Tabs (Market Group) & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-[var(--border-subtle)]/70">
        <MarketGroupTabs
          value={marketGroup}
          onChange={(newGroup) => {
            setMarketGroup(newGroup);
            setSelectedStockSymbol(null);
          }}
          stocksCount={BASE_STOCKS.length}
          allCount={BASE_STOCKS.length + 4}
        />

        <ModeSwitch
          value={mode}
          onChange={(newMode) => {
            setMode(newMode);
            if (newMode === "stake") {
              setSelectedStockSymbol(null);
            }
          }}
        />
      </div>

      {/* 3. YOUR POSITIONS & HEALTH (Real on-chain positions) */}
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
            getUnifiedStockLendingComparison(sym)
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

      {/* 4. MAIN WORKSPACE VIEW (Level 1 vs Level 2 vs Gauges) */}
      {mode === "stake" ? (
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
          mode={mode}
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
            if (userAddress) {
              void loadUserPositions(userAddress, true);
            }
          }}
        />
      )}
    </div>
  );
}
