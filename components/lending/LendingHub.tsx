"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { getBaselineVerifiedMarkets } from "@/lib/lending/discovery/baseline";
import LendingHeader from "./LendingHeader";
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
import {
  VERIFIED_IPOR_STOCK_VAULTS,
  VERIFIED_AERODROME_STOCK_POOLS,
  VERIFIED_BEEFY_STOCK_DETAILS,
} from "@/lib/lending/unified-comparison";
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
import { batchPriceTokens } from "@/lib/portfolio/pricing";
import { formatUnits } from "viem";

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

  // Seconds ago timer tick
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  // Stale request tracking refs
  const comparisonReqIdRef = useRef<number>(0);
  const exploreReqIdRef = useRef<number>(0);

  // Load comparison data when selectedStockSymbol changes or on refresh
  const loadComparison = useCallback(async (symbol: string, force = false) => {
    const reqId = ++comparisonReqIdRef.current;
    setIsLoadingComparison(true);
    try {
      const data = await getUnifiedStockLendingComparison(symbol, undefined, force);
      if (comparisonReqIdRef.current === reqId) {
        setComparison(data);
        setLastUpdated(Date.now());
        setSecondsAgo(0);
      }
    } catch (err) {
      console.error("Failed to load comparison for stock:", symbol, err);
      if (comparisonReqIdRef.current === reqId) {
        showToast(`Failed to load comparison for ${symbol}`, "Please check your network connection.");
      }
    } finally {
      if (comparisonReqIdRef.current === reqId) {
        setIsLoadingComparison(false);
      }
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedStockSymbol) {
      loadComparison(selectedStockSymbol);
    } else {
      setComparison(null);
    }
  }, [selectedStockSymbol, loadComparison]);

  // Periodic background refresh for active comparison (every 20s, paused when tab hidden)
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (selectedStockSymbol) {
        void loadComparison(selectedStockSymbol, true);
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

        // Canonical stocks to query balances via single multicall
        const topStocks = BASE_STOCKS;
        const contracts = topStocks.map((stk) => ({
          address: stk.address,
          abi: [
            {
              name: "balanceOf",
              type: "function",
              stateMutability: "view",
              inputs: [{ name: "account", type: "address" }],
              outputs: [{ name: "", type: "uint256" }],
            },
          ] as const,
          functionName: "balanceOf" as const,
          args: [user] as const,
        }));

        const results = await pub.multicall({ contracts });
        if (!alive) return;

        const mapping: Record<string, number> = {};
        topStocks.forEach((stk, idx) => {
          const res = results[idx];
          const raw = res && res.status === "success" ? (res.result as bigint) : BigInt(0);
          const bal = parseFloat(formatUnits(raw, stk.decimals)) || 0;
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

  // Real feed & oracle prices for tokenized stocks
  const [stockPrices, setStockPrices] = useState<Record<string, { priceUsd: number | null; priceChange24h: number | null }>>({});

  useEffect(() => {
    let alive = true;
    async function fetchPrices() {
      try {
        const addresses = ALL_BASE_STOCKS.map((s) => s.address as `0x${string}`);
        const priceMap = await batchPriceTokens(addresses);
        if (!alive) return;
        const prices: Record<string, { priceUsd: number | null; priceChange24h: number | null }> = {};
        priceMap.forEach((v, k) => {
          prices[k.toLowerCase()] = {
            priceUsd: v.priceUsd,
            priceChange24h: v.priceChange24h,
          };
        });
        setStockPrices(prices);
      } catch (err) {
        console.warn("[LendingHub] Failed to fetch real stock prices:", err);
      }
    }
    void fetchPrices();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void fetchPrices();
    }, 60_000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  // Discovered markets state from /api/markets, seeded with verified onchain baseline
  const [discoveredMarkets, setDiscoveredMarkets] = useState<import("@/lib/lending/discovery/types").NormalizedMarket[]>(() => getBaselineVerifiedMarkets());
  const [protocolErrors, setProtocolErrors] = useState<Record<string, string>>({});
  const [isLoadingDiscovered, setIsLoadingDiscovered] = useState(false);
  const [isMarketsStale, setIsMarketsStale] = useState(false);
  const [showAllStocks, setShowAllStocks] = useState(false);

  const fetchDiscoveredMarkets = useCallback(async (refresh = false) => {
    setIsLoadingDiscovered(true);
    try {
      const res = await fetch(`/api/markets?chainId=8453${refresh ? "&refresh=true" : ""}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.markets) && data.markets.length > 0) {
          setDiscoveredMarkets(data.markets);
          setIsMarketsStale(false);
          const errs: Record<string, string> = {};
          if (data.protocolStatus && typeof data.protocolStatus === "object") {
            for (const [k, v] of Object.entries(data.protocolStatus as Record<string, { status?: string; error?: string }>)) {
              if (v?.status === "error") {
                errs[k] = v.error || "Error";
              }
            }
          }
          // Clear old protocolErrors for healthy protocols by setting exact current active errors
          setProtocolErrors(errs);
          setLastUpdated(Date.now());
          setSecondsAgo(0);
        } else {
          // Empty response: preserve last good data, mark as stale
          setIsMarketsStale(true);
        }
      } else {
        setIsMarketsStale(true);
      }
    } catch (e) {
      console.warn("Discovered markets fetch error:", e);
      setIsMarketsStale(true);
    } finally {
      setIsLoadingDiscovered(false);
    }
  }, []);

  useEffect(() => {
    void fetchDiscoveredMarkets();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void fetchDiscoveredMarkets(true);
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchDiscoveredMarkets]);

  // 1. Markets Overview (Level 1) Rows Generation - Derived dynamically from discovery
  const stockRows: AssetMarketRow[] = useMemo(() => {
    const stockList = showAllStocks ? ALL_BASE_STOCKS : BASE_STOCKS;
    return stockList.map((stk) => {
      const matchingMarkets = discoveredMarkets.filter(
        (m) =>
          m.collateralAsset?.address.toLowerCase() === stk.address.toLowerCase() ||
          m.supplyAsset.address.toLowerCase() === stk.address.toLowerCase() ||
          m.collateralAsset?.symbol.toLowerCase() === stk.symbol.toLowerCase() ||
          m.supplyAsset.symbol.toLowerCase() === stk.symbol.toLowerCase() ||
          (stk.symbol === "GOOGLc" && (m.supplyAsset.symbol.toLowerCase() === "googc" || m.collateralAsset?.symbol.toLowerCase() === "googc"))
      );

      // Protocol-specific rates (for Beefy, Aerodrome, Aave Pro, IPOR Fusion)
      // 1. Beefy Finance
      const beefyMkt = matchingMarkets.find((m) => m.protocol === "beefy");
      const beefyVerified = VERIFIED_BEEFY_STOCK_DETAILS[stk.symbol];
      const beefyApy = beefyMkt?.supplyApy ?? beefyVerified?.apy ?? 0;
      const beefyLiquidity = beefyMkt?.liquidityUsd || beefyMkt?.tvlUsd || beefyVerified?.tvlUsd || 0;
      const hasBeefy = Boolean((beefyMkt && (beefyMkt.supplyApy > 0 || beefyMkt.liquidityUsd > 0)) || (beefyVerified && (beefyApy > 0 || beefyLiquidity > 0)));

      // 2. Aerodrome Finance
      const aeroMkt = matchingMarkets.find((m) => m.protocol === "aerodrome");
      const aeroVerified = VERIFIED_AERODROME_STOCK_POOLS[stk.symbol];
      const aeroApy = aeroMkt?.supplyApy ?? aeroVerified?.supplyApy ?? 0;
      const aeroLiquidity = aeroMkt?.liquidityUsd || aeroMkt?.tvlUsd || aeroVerified?.tvlUsd || 0;
      const hasAero = Boolean((aeroMkt && (aeroMkt.supplyApy > 0 || aeroMkt.liquidityUsd > 0)) || (aeroVerified && (aeroApy > 0 || aeroLiquidity > 0)));

      // 3. Aave Pro (Equities Collateral Lending Hub on Base)
      const aaveMkt = matchingMarkets.find((m) => m.protocol === "aave");
      const aaveSupplyApy = aaveMkt?.supplyApy ?? 0;
      const aaveBorrowApr = aaveMkt?.borrowApr ?? null;
      const aaveLiquidity = aaveMkt?.liquidityUsd || aaveMkt?.tvlUsd || 0;
      const hasAave = Boolean(
        aaveMkt && (aaveMkt.supplyApy > 0 || (aaveMkt.borrowApr ?? 0) > 0 || aaveMkt.liquidityUsd > 0)
      );

      // 4. IPOR Fusion (Stock Carry Trade & Lending Plasma Vaults on Base)
      const iporMkt = matchingMarkets.find((m) => m.protocol === "ipor");
      const iporVerified = VERIFIED_IPOR_STOCK_VAULTS[stk.symbol] ?? (stk.symbol === "GOOGLc" ? VERIFIED_IPOR_STOCK_VAULTS["GOOGc"] : undefined);
      const iporApy = iporMkt?.supplyApy ?? iporVerified?.apy ?? 0;
      const iporBorrowApr = iporMkt?.borrowApr ?? iporVerified?.borrowApr ?? null;
      const iporLiquidity = iporMkt?.liquidityUsd || iporMkt?.tvlUsd || iporVerified?.tvlUsd || 0;
      const hasIpor = Boolean(
        (iporMkt && (iporMkt.supplyApy > 0 || (iporMkt.borrowApr ?? 0) > 0 || iporMkt.liquidityUsd > 0)) ||
        (iporVerified && (iporApy > 0 || (iporBorrowApr ?? 0) > 0 || iporLiquidity > 0))
      );

      const protocolRates: Record<string, ProtocolRateInfo> = {
        beefy: {
          supplyApy: beefyApy,
          borrowApr: null,
          borrowLabel: "Yield Vault",
          liquidityUsd: beefyLiquidity,
          protocolLabel: "Beefy Finance",
          hasMarket: hasBeefy,
          typeLabel: "Auto-Compounder",
        },
        aerodrome: {
          supplyApy: aeroApy,
          borrowApr: null,
          borrowLabel: "DEX Pool",
          liquidityUsd: aeroLiquidity,
          protocolLabel: "Aerodrome Finance",
          hasMarket: hasAero,
          typeLabel: "DEX Gauge",
        },
        aave: {
          supplyApy: aaveSupplyApy,
          borrowApr: aaveBorrowApr,
          borrowLabel: "Aave Pro",
          liquidityUsd: aaveLiquidity,
          protocolLabel: "Aave Pro",
          hasMarket: hasAave,
          typeLabel: "Equities Lending",
        },
        ipor: {
          supplyApy: iporApy,
          borrowApr: iporBorrowApr,
          borrowLabel: "IPOR Fusion",
          liquidityUsd: iporLiquidity,
          protocolLabel: "IPOR Fusion",
          hasMarket: hasIpor,
          typeLabel: "Carry Plasma Vault",
        },
      };

      const hasLendingMarket =
        matchingMarkets.some((m) => m.supplyApy > 0 || (m.borrowApr ?? 0) > 0 || m.liquidityUsd > 0) ||
        hasAave ||
        hasIpor ||
        hasBeefy ||
        hasAero;
      const protocolSet = new Set<string>();
      for (const m of matchingMarkets) {
        if (m.supplyApy > 0 || (m.borrowApr ?? 0) > 0 || m.liquidityUsd > 0) {
          protocolSet.add(m.protocolLabel);
        }
      }
      if (hasBeefy) protocolSet.add("Beefy Finance");
      if (hasAero) protocolSet.add("Aerodrome Finance");
      if (hasAave) protocolSet.add("Aave Pro");
      if (hasIpor) protocolSet.add("IPOR Fusion");
      const listedProtocols = Array.from(protocolSet);

      // Real Supply/Staking APY: from yield vaults, staking pools, or stock supply pools
      const supplyMarkets = matchingMarkets.filter(
        (m) =>
          (m.type === "stake" ||
            m.type === "lend" ||
            m.supplyAsset.address.toLowerCase() === stk.address.toLowerCase()) &&
          m.supplyApy > 0
      );
      const bestSupplyMkt = supplyMarkets.sort((a, b) => b.supplyApy - a.supplyApy)[0];
      let bestSupplyApy = bestSupplyMkt?.supplyApy ?? 0;
      let bestSupplyProtocol =
        bestSupplyMkt?.protocolLabel ?? (hasLendingMarket ? "Collateral only" : "None");

      // Fallback bestSupply if matchingMarkets was not yet hydrated
      if (bestSupplyApy === 0) {
        if (hasBeefy && beefyApy > 0) {
          bestSupplyApy = beefyApy;
          bestSupplyProtocol = "Beefy Finance";
        } else if (hasAero && aeroApy > 0) {
          bestSupplyApy = aeroApy;
          bestSupplyProtocol = "Aerodrome Finance";
        } else if (hasIpor && iporApy > 0) {
          bestSupplyApy = iporApy;
          bestSupplyProtocol = "IPOR Fusion";
        } else if (hasAave && aaveSupplyApy > 0) {
          bestSupplyApy = aaveSupplyApy;
          bestSupplyProtocol = "Aave Pro";
        }
      }

      // Real Borrow APR: from borrowing markets where stock is collateral
      const borrowMarkets = matchingMarkets.filter(
        (m) => m.type === "borrow" && m.borrowApr !== undefined && m.borrowApr > 0
      );
      // Prefer borrow markets with verified available depth > $10
      const fundedBorrowMarkets = borrowMarkets.filter((m) => (m.liquidityUsd || 0) > 10);
      const borrowCandidates = fundedBorrowMarkets.length > 0 ? fundedBorrowMarkets : borrowMarkets;
      const bestBorrowMkt = borrowCandidates.sort(
        (a, b) => (a.borrowApr ?? 999) - (b.borrowApr ?? 999)
      )[0];
      let bestBorrowApr = bestBorrowMkt?.borrowApr ?? null;
      let bestBorrowProtocol = bestBorrowMkt?.protocolLabel ?? null;

      if (bestBorrowApr === null) {
        if (hasAave && aaveBorrowApr) {
          bestBorrowApr = aaveBorrowApr;
          bestBorrowProtocol = "Aave Pro";
        } else if (hasIpor && iporBorrowApr) {
          bestBorrowApr = iporBorrowApr;
          bestBorrowProtocol = "IPOR Fusion";
        }
      }

      // Real Total Liquidity: sum of real discovered depth across active protocols
      let totalLiquidityUsd = matchingMarkets.reduce(
        (sum, m) => sum + (m.liquidityUsd > 0 ? m.liquidityUsd : (m.tvlUsd || 0)),
        0
      );
      if (totalLiquidityUsd === 0) {
        totalLiquidityUsd = (hasBeefy ? beefyLiquidity : 0) + (hasAero ? aeroLiquidity : 0) + (hasAave ? aaveLiquidity : 0) + (hasIpor ? iporLiquidity : 0);
      }

      // Check if newly listed (within last 7 days)
      const isNew = stk.addedAt ? isNewStock(stk.addedAt) : false;

      const riskFlags = Array.from(new Set(matchingMarkets.flatMap((m) => m.riskFlags)));
      const oracleVerified = matchingMarkets.length > 0 ? !riskFlags.includes("UNKNOWN_ORACLE") : false;

      const priceInfo = stockPrices[stk.address.toLowerCase()];
      const priceUsd = priceInfo?.priceUsd ?? null;
      const priceChange24h = priceInfo?.priceChange24h ?? null;

      const bal = walletBalances[stk.symbol] ?? null;
      const balUsd = bal !== null && priceUsd !== null ? bal * priceUsd : null;

      return {
        symbol: stk.symbol,
        name: stk.name,
        category: stk.category ?? "tech",
        address: stk.address,
        priceUsd,
        priceChange24h,
        bestSupplyApy,
        bestSupplyProtocol,
        bestBorrowApr,
        bestBorrowProtocol,
        totalLiquidityUsd,
        walletBalance: bal,
        walletBalanceUsd: balUsd,
        isNew,
        listedProtocols: listedProtocols.length > 0 ? listedProtocols : ["No Pool"],
        hasLendingMarket,
        riskFlags,
        oracleVerified,
        protocolRates,
        utilization: matchingMarkets.find((m) => m.utilization !== undefined)?.utilization ?? null,
        riskTier: (riskFlags.length > 1 ? "degen" : riskFlags.length === 1 ? "medium" : "low") as "low" | "medium" | "degen",
      };
    });
  }, [discoveredMarkets, walletBalances, showAllStocks, stockPrices]);

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

  // 3. Live Stats Calculations for Header (Active markets only, no double counting, no fake 50 fallback)
  const headerStats = useMemo(() => {
    let topSupply = 0;
    let lowestBorrow = 999;
    let totalLiquidity = 0;

    const activeMarkets = discoveredMarkets.filter((m) => m.status === "active");
    const seenMarkets = new Set<string>();

    activeMarkets.forEach((m) => {
      const key = m.marketId || m.contractAddress;
      if (key && seenMarkets.has(key)) return;
      if (key) seenMarkets.add(key);

      if (m.supplyApy > topSupply) topSupply = m.supplyApy;
      if (m.borrowApr && m.borrowApr > 0 && m.borrowApr < lowestBorrow) {
        lowestBorrow = m.borrowApr;
      }
      // Never add TVL and liquidity together; prioritize liquidityUsd, fallback to tvlUsd
      const poolLiquidity = m.liquidityUsd > 0 ? m.liquidityUsd : (m.tvlUsd > 0 ? m.tvlUsd : 0);
      totalLiquidity += poolLiquidity;
    });

    return {
      topSupplyApy: topSupply > 0 ? topSupply : 0,
      lowestBorrowApr: lowestBorrow < 999 ? lowestBorrow : 0,
      totalLiquidityUsd: totalLiquidity,
      verifiedPoolsCount: activeMarkets.length,
    };
  }, [discoveredMarkets]);

  // 4. Real On-chain User Positions
  const [userPositions, setUserPositions] = useState<UserProtocolPosition[]>([]);
  const [positionsErrors, setPositionsErrors] = useState<Record<string, string>>({});
  const [isLoadingPositions, setIsLoadingPositions] = useState<boolean>(false);
  const [isRefreshingPositions, setIsRefreshingPositions] = useState<boolean>(false);
  const [lastPositionsUpdated, setLastPositionsUpdated] = useState<number>(() => Date.now());
  const [positionsSecondsAgo, setPositionsSecondsAgo] = useState<number>(0);
  const [isMockPositionsData, setIsMockPositionsData] = useState<boolean>(false);
  const [isWrongNetwork, setIsWrongNetwork] = useState<boolean>(false);

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

  // Check if wallet is on Base (8453 / 0x2105) and listen for chainChanged / accountsChanged
  useEffect(() => {
    if (!isConnected || typeof window === "undefined") {
      setIsWrongNetwork(false);
      return;
    }
    let alive = true;
    let activeProvider: {
      request: (args: { method: string }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    } | null = null;

    const handleChain = (chainIdHex: unknown) => {
      if (!alive) return;
      const normalized = String(chainIdHex).toLowerCase();
      const wrong = Boolean(normalized && normalized !== "0x2105" && normalized !== "8453");
      setIsWrongNetwork(wrong);
      if (!wrong && userAddress) {
        void loadUserPositions(userAddress, true);
      }
    };

    const handleAccounts = (accounts: unknown) => {
      if (!alive) return;
      const list = Array.isArray(accounts) ? accounts : [];
      if (list.length > 0 && typeof list[0] === "string") {
        void loadUserPositions(list[0], true);
      } else {
        setUserPositions([]);
      }
    };

    async function checkChainAndAttachListeners() {
      try {
        const providerType = (connType ?? "injected") as "farcaster" | "baseAccount" | "coinbase" | "metamask" | "injected";
        const provider = (await getEip1193Provider(providerType)) as typeof activeProvider;
        activeProvider = provider;
        if (provider?.request) {
          const chainId = (await provider.request({ method: "eth_chainId" })) as string;
          const normalized = chainId?.toLowerCase();
          if (alive) {
            setIsWrongNetwork(Boolean(normalized && normalized !== "0x2105" && normalized !== "8453"));
          }
          if (provider.on) {
            provider.on("chainChanged", handleChain);
            provider.on("accountsChanged", handleAccounts);
          }
        }
      } catch {
        if (alive) setIsWrongNetwork(false);
      }
    }
    void checkChainAndAttachListeners();

    return () => {
      alive = false;
      if (activeProvider?.removeListener) {
        activeProvider.removeListener("chainChanged", handleChain);
        activeProvider.removeListener("accountsChanged", handleAccounts);
      }
    };
  }, [isConnected, connType, userAddress, loadUserPositions]);

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
        for (const k of Object.keys(copy)) {
          if (
            k.toLowerCase() === protocol.toLowerCase() ||
            k.toLowerCase().includes(protocol.toLowerCase()) ||
            protocol.toLowerCase().includes(k.toLowerCase())
          ) {
            delete copy[k];
          }
        }
        return copy;
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Retry failed";
      setPositionsErrors((prev) => {
        const key =
          Object.keys(prev).find(
            (k) =>
              k.toLowerCase() === protocol.toLowerCase() ||
              k.toLowerCase().includes(protocol.toLowerCase())
          ) ?? protocol;
        return { ...prev, [key]: msg };
      });
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

  // Handle Explore Vault click from YieldCalculator or TopYieldSpotlight
  const handleExploreYieldOption = async (option: {
    protocol: string;
    stockSymbol?: string;
    contractAddress?: string;
    marketId?: string;
  }) => {
    // Only select stock symbol if explicitly provided (never default to NVDAc)
    if (option.stockSymbol) {
      setSelectedStockSymbol(option.stockSymbol);
    }

    // 1. Direct match in BASE_LENDING_MARKETS (Beefy, Morpho, Moonwell, Aerodrome)
    const matchedMarket =
      BASE_LENDING_MARKETS.find(
        (m) =>
          (option.marketId && m.id === option.marketId) ||
          (option.contractAddress &&
            m.contractAddress?.toLowerCase() === option.contractAddress.toLowerCase())
      ) ||
      (option.stockSymbol
        ? BASE_LENDING_MARKETS.find(
            (m) =>
              (m.protocol.toLowerCase() === option.protocol.toLowerCase() ||
                (option.protocol.toLowerCase().includes("morpho") && m.protocol === "morpho")) &&
              m.asset.symbol.toLowerCase().includes(option.stockSymbol!.toLowerCase())
          )
        : BASE_LENDING_MARKETS.find(
            (m) =>
              m.protocol.toLowerCase() === option.protocol.toLowerCase() ||
              (option.protocol.toLowerCase().includes("morpho") && m.protocol === "morpho") ||
              (option.protocol.toLowerCase().includes("moonwell") && m.protocol === "moonwell")
          ));

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
        (option.stockSymbol && g.stockSymbol?.toLowerCase() === option.stockSymbol.toLowerCase())
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

    // 3. Try to load options for Level 3 drawer if stockSymbol is present
    if (option.stockSymbol) {
      const sym = option.stockSymbol;
      const reqId = ++exploreReqIdRef.current;
      try {
        setActiveTab("stocks");
        const res = await getUnifiedStockLendingComparison(sym);
        if (exploreReqIdRef.current !== reqId) return;
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
        if (exploreReqIdRef.current === reqId) {
          console.warn("Failed to load options for yield calculator selection:", e);
          showToast(`Failed to load options for ${sym}`, "Please check your network connection.");
        }
      }
    }

    // 4. Default fallback: Search in BASE_LENDING_MARKETS
    const fallbackMarket =
      BASE_LENDING_MARKETS.find(
        (m) =>
          (option.marketId && m.id === option.marketId) ||
          (option.contractAddress &&
            m.contractAddress?.toLowerCase() === option.contractAddress.toLowerCase()) ||
          m.protocol.toLowerCase() === option.protocol.toLowerCase() ||
          option.protocol.toLowerCase().includes(m.protocol.toLowerCase())
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

  // Sticky Connected Portfolio Summary
  const stickySummary = useMemo(() => {
    if (!isConnected || userPositions.length === 0) return null;
    const totalSupplied = userPositions.reduce((acc, p) => acc + p.suppliedUsd, 0);
    const totalBorrowed = userPositions.reduce((acc, p) => acc + p.borrowedUsd, 0);
    const netApy =
      totalSupplied > 0
        ? userPositions.reduce((acc, p) => acc + p.suppliedUsd * p.apy, 0) / totalSupplied
        : 0;
    const debtPositions = userPositions.filter((p) => p.borrowedUsd > 0 && p.healthFactor !== null);
    const lowestHF =
      debtPositions.length > 0 ? Math.min(...debtPositions.map((p) => p.healthFactor!)) : null;

    return {
      totalSupplied,
      totalBorrowed,
      netApy,
      healthFactor: lowestHF,
    };
  }, [isConnected, userPositions]);

  return (
    <div className="space-y-6 pb-16 animate-meridian-rise">
      {/* 1. COMPACT HEADER WITH LIVE STATS & DISCLAIMER */}
      <LendingHeader
        topSupplyApy={headerStats.topSupplyApy}
        lowestBorrowApr={headerStats.lowestBorrowApr}
        totalLiquidityUsd={headerStats.totalLiquidityUsd}
        verifiedPoolsCount={headerStats.verifiedPoolsCount}
        lastUpdatedSecondsAgo={secondsAgo}
        isStale={isMarketsStale}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Sticky Connected Summary Bar */}
      {isConnected && stickySummary && (
        <div className="sticky top-2 z-20 backdrop-blur-md bg-[var(--surface-3)]/95 border border-[var(--border-subtle)] rounded-2xl p-3 px-4 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-[var(--ink)]">Portfolio Snapshot:</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div>
              <span className="text-[var(--ink-muted)] text-[11px] block">Supplied</span>
              <span className="font-mono font-bold text-[var(--ink)]">
                ${stickySummary.totalSupplied.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[var(--ink-muted)] text-[11px] block">Borrowed</span>
              <span className="font-mono font-bold text-[var(--ink)]">
                ${stickySummary.totalBorrowed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[var(--ink-muted)] text-[11px] block">Net APY</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {stickySummary.netApy > 0 ? `+${stickySummary.netApy.toFixed(2)}%` : "0.00%"}
              </span>
            </div>
            <div>
              <span className="text-[var(--ink-muted)] text-[11px] block">Health Factor</span>
              <span
                className={`font-mono font-bold ${
                  stickySummary.healthFactor === null
                    ? "text-emerald-600 dark:text-emerald-400"
                    : stickySummary.healthFactor >= 1.5
                      ? "text-emerald-600 dark:text-emerald-400"
                      : stickySummary.healthFactor >= 1.15
                        ? "text-amber-500"
                        : "text-rose-500"
                }`}
              >
                {stickySummary.healthFactor !== null ? stickySummary.healthFactor.toFixed(2) : "∞ (Safe)"}
              </span>
            </div>
          </div>
        </div>
      )}

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
        onShowToast={(title, desc) => showToast(title, desc ?? "")}
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
                showToast("Failed to load position details", "Please try again or check network connection.");
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <LendingViewTabs
          value={activeTab}
          onChange={(newTab) => {
            setActiveTab(newTab);
            setSelectedStockSymbol(null);
          }}
          stocksCount={showAllStocks ? ALL_BASE_STOCKS.length : BASE_STOCKS.length}
          vaultsCount={gaugeRows.length}
          protocolsCount={new Set(discoveredMarkets.filter((m) => m.status === "active").map((m) => m.protocol)).size || undefined}
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
          markets={discoveredMarkets}
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
          userPositions={userPositions}
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
