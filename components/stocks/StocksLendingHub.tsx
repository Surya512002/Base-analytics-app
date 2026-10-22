"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { motion } from "motion/react";
import {
  Coins,
  Lock,
  Sparkles,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  SlidersHorizontal,
  Wallet,
  Loader2,
  Layers,
  ArrowUpRight,
  Info,
  RefreshCw,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { parseAbi, formatUnits } from "viem";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { BASE_STOCKS, type BaseStock } from "@/lib/stocks/base-stocks";
import {
  getUnifiedStockLendingComparison,
  type StockLendingComparison,
  type StockLendingOption,
} from "@/lib/lending/unified-comparison";
import StockDetailComparisonModal, { type ModalActionType } from "./StockDetailComparisonModal";
import { buildStockFromBaseStock, type CoinbaseTokenizedStock } from "@/lib/stocks/coinbase-api";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { USDC_BASE } from "@/lib/constants/contracts";

interface StocksLendingHubProps {
  app: WalletAppState;
  guestMode?: boolean;
  onRequestConnect?: () => void;
  initialStock?: string;
}

type SortOrder = "best_supply" | "best_borrow" | "liquidity";
type FilterTab = "all" | "borrow" | "supply" | "strategies";

export default function StocksLendingHub({
  app,
  guestMode = false,
  onRequestConnect,
  initialStock = "NVDAc",
}: StocksLendingHubProps) {
  const { wallet, connType, showToast } = app;
  const userAddress = wallet?.address ?? null;

  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string>(initialStock);
  const [comparison, setComparison] = useState<StockLendingComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [sortBy, setSortBy] = useState<SortOrder>("best_supply");

  // Real-time polling & refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Stock Search & Filter state
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtered stocks based on search query
  const filteredStocks = useMemo(() => {
    if (!stockSearchQuery.trim()) return BASE_STOCKS;
    const q = stockSearchQuery.trim().toLowerCase();
    return BASE_STOCKS.filter(
      (stk) =>
        stk.symbol.toLowerCase().includes(q) ||
        stk.name.toLowerCase().includes(q) ||
        (stk.category && stk.category.toLowerCase().includes(q))
    );
  }, [stockSearchQuery]);

  // Horizontal scroll state & controls for stock pills
  const stockScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateStockScrollState = useCallback(() => {
    const el = stockScrollRef.current;
    if (!el) return;
    const tolerance = 4;
    setCanScrollLeft(el.scrollLeft > tolerance);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - tolerance);
  }, []);

  useEffect(() => {
    const el = stockScrollRef.current;
    if (!el) return;
    updateStockScrollState();

    el.addEventListener("scroll", updateStockScrollState, { passive: true });
    window.addEventListener("resize", updateStockScrollState);

    const timer1 = setTimeout(updateStockScrollState, 100);
    const timer2 = setTimeout(updateStockScrollState, 350);

    return () => {
      el.removeEventListener("scroll", updateStockScrollState);
      window.removeEventListener("resize", updateStockScrollState);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [updateStockScrollState, filteredStocks]);

  // Auto-scroll selected stock into view
  useEffect(() => {
    const container = stockScrollRef.current;
    if (!container) return;
    const activeEl = container.querySelector(
      `[data-stock-symbol="${selectedStockSymbol.toLowerCase()}"]`
    ) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
    }
  }, [selectedStockSymbol]);

  const scrollStocks = (direction: "left" | "right") => {
    const el = stockScrollRef.current;
    if (!el) return;
    const distance = Math.max(260, Math.floor(el.clientWidth * 0.65));
    el.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  // Real onchain wallet balances
  const [walletStockBalance, setWalletStockBalance] = useState<number | null>(null);
  const [walletUsdcBalance, setWalletUsdcBalance] = useState<number | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Modal State
  const [comparisonModalStock, setComparisonModalStock] = useState<CoinbaseTokenizedStock | null>(null);
  const [modalOptionId, setModalOptionId] = useState<string | null>(null);
  const [modalAction, setModalAction] = useState<ModalActionType | null>(null);

  // Selected stock object
  const currentStock = useMemo(() => {
    const s = BASE_STOCKS.find(
      (item) => item.symbol.toLowerCase() === selectedStockSymbol.toLowerCase()
    );
    return s ? buildStockFromBaseStock(s) : buildStockFromBaseStock(BASE_STOCKS[0]!);
  }, [selectedStockSymbol]);

  // Load real onchain balances for selected stock + USDC
  const fetchRealBalances = useCallback(async () => {
    if (!userAddress) {
      setWalletStockBalance(null);
      setWalletUsdcBalance(null);
      return;
    }

    setLoadingBalances(true);

    try {
      const pub = createBasePublicClient();
      const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

      const [rawStock, rawUsdc] = await Promise.all([
        pub.readContract({
          address: currentStock.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [userAddress as `0x${string}`],
        }).catch(() => BigInt(0)),
        pub.readContract({
          address: USDC_BASE as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [userAddress as `0x${string}`],
        }).catch(() => BigInt(0)),
      ]);

      const humanStock = parseFloat(formatUnits(rawStock, currentStock.decimals));
      const humanUsdc = parseFloat(formatUnits(rawUsdc, 6));

      setWalletStockBalance(Number.isFinite(humanStock) ? humanStock : 0);
      setWalletUsdcBalance(Number.isFinite(humanUsdc) ? humanUsdc : 0);
    } catch {
      setWalletStockBalance(0);
      setWalletUsdcBalance(0);
    } finally {
      setLoadingBalances(false);
    }
  }, [userAddress, currentStock.address, currentStock.decimals]);

  useEffect(() => {
    void fetchRealBalances();
  }, [fetchRealBalances]);

  // Load comparison options
  const loadData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const compData = await getUnifiedStockLendingComparison(selectedStockSymbol, undefined, isBackground);
      if (compData) {
        setComparison(compData);
        setLastUpdated(compData.lastUpdated || Date.now());
        setSecondsAgo(0);
      }
    } catch {
      // Graceful fallback - keep previous comparison values
    } finally {
      if (!isBackground) setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedStockSymbol]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Auto-poll rates and balances every 20 seconds in near real-time
  useEffect(() => {
    const interval = setInterval(() => {
      // Pause polling if user switched away to another browser tab
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      loadData(true);
      fetchRealBalances();
    }, 20_000);

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadData(true);
        fetchRealBalances();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadData, fetchRealBalances]);

  // Second-by-second ticker for "Updated Xs ago" relative time display
  useEffect(() => {
    const ticker = setInterval(() => {
      if (lastUpdated) {
        setSecondsAgo(Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000)));
      }
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastUpdated]);

  // Sorted and filtered options
  const sortedAndFilteredOptions = useMemo(() => {
    if (!comparison) return [];
    let list = [...comparison.options];

    // Filter
    if (activeTab === "borrow") {
      list = list.filter((o) => o.borrowApr !== null);
    } else if (activeTab === "supply") {
      list = list.filter((o) => o.type !== "strategy");
    } else if (activeTab === "strategies") {
      list = list.filter((o) => o.type === "strategy");
    }

    // Sort
    if (sortBy === "best_supply") {
      list.sort((a, b) => b.supplyApy - a.supplyApy);
    } else if (sortBy === "best_borrow") {
      list.sort((a, b) => (a.borrowApr ?? 999) - (b.borrowApr ?? 999));
    } else if (sortBy === "liquidity") {
      list.sort((a, b) => b.availableLiquidityUsd - a.availableLiquidityUsd);
    }

    return list;
  }, [comparison, activeTab, sortBy]);

  // Open modal with specific action
  const handleOpenAction = (opt: StockLendingOption, action: ModalActionType) => {
    if (guestMode && onRequestConnect) {
      onRequestConnect();
      return;
    }
    setModalOptionId(opt.id);
    setModalAction(action);
    setComparisonModalStock(currentStock);
  };

  // Determine label and default action for a single button
  const getActionDetails = (opt: StockLendingOption) => {
    if (opt.type === "strategy") {
      return {
        label: "Deposit to Strategy",
        action: "strategy_deposit" as ModalActionType,
        icon: Sparkles,
      };
    }
    if (activeTab === "borrow" || (activeTab === "all" && sortBy === "best_borrow" && opt.borrowApr !== null)) {
      return {
        label: `Borrow USDC`,
        action: "borrow" as ModalActionType,
        icon: Lock,
      };
    }
    return {
      label: `Supply ${currentStock.symbol}`,
      action: "supply" as ModalActionType,
      icon: TrendingUp,
    };
  };

  return (
    <div className="space-y-6 pb-12 animate-meridian-rise">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-7 shadow-[var(--shadow-card)]">
        <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--brand)]" aria-hidden />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[var(--brand-soft)] text-[var(--brand-dark)] border border-[var(--brand)]/20">
                <Sparkles size={12} />
                STOCK LENDING &amp; BORROWING
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-[var(--surface-2)] text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                <ShieldCheck size={12} className="text-emerald-500" />
                Morpho · Aave V4 · Euler · Superform · Moonwell
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--ink)]">
              Compare Lending &amp; Borrowing for {currentStock.name}
            </h2>
            <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
              Compare live securities lending yields and USDC borrow rates across verified Base protocols for Coinbase tokenized stocks. 1-click execution with real wallet balances.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={() => {
                if (comparison?.bestBorrowOption) {
                  handleOpenAction(comparison.bestBorrowOption, "borrow");
                } else {
                  setComparisonModalStock(currentStock);
                }
              }}
              className="btn-primary py-2.5 px-5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Execute {currentStock.symbol} Position</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Unified Stock & Strategy Control Deck */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5 shadow-[var(--shadow-card)] space-y-4">
        {/* Header: Label + Live Status + Live Balances */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--brand-soft)] text-[var(--brand-dark)]">
              <Sparkles size={13} />
              Securities Lending Hub
            </span>

            {/* Live Real-Time Indicator Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Live</span>
              <span className="text-[var(--ink-dim)] font-mono text-[10px] font-normal">
                · {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}
              </span>
            </div>

            {/* Manual Refresh Button */}
            <button
              type="button"
              onClick={() => {
                loadData(true);
                fetchRealBalances();
              }}
              disabled={isRefreshing}
              className="p-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--border-strong)] transition-all cursor-pointer disabled:opacity-50"
              title="Refresh live APYs & borrow rates"
              aria-label="Refresh rates"
            >
              <RefreshCw size={12} className={isRefreshing ? "animate-spin text-[var(--brand)]" : ""} />
            </button>
          </div>

          {/* Real Wallet Balance Display */}
          <div className="flex items-center gap-2 font-mono text-[11px] self-start sm:self-auto">
            {userAddress ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border-subtle)]">
                <Wallet size={12} className="text-[var(--brand)]" />
                {loadingBalances ? (
                  <span className="text-[var(--ink-dim)]">Fetching wallet balance…</span>
                ) : (
                  <span>
                    <strong>{(walletStockBalance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong> {currentStock.symbol}
                    {walletUsdcBalance !== null && (
                      <span className="text-[var(--ink-dim)] ml-1">
                        · ${walletUsdcBalance.toFixed(2)} USDC
                      </span>
                    )}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[var(--ink-dim)] text-xs">
                Connect wallet to view live balances
              </span>
            )}
          </div>
        </div>

        {/* 1. Horizontal Stock Selector Pill Strip with Search & Side Scrollers */}
        <div className="space-y-2">
          {/* Active Search Result Banner */}
          {stockSearchQuery.trim() && (
            <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink-muted)]">
              <span>
                Found <strong>{filteredStocks.length}</strong> matching stock{filteredStocks.length === 1 ? "" : "s"} for &quot;<strong>{stockSearchQuery}</strong>&quot;
              </span>
              <button
                type="button"
                onClick={() => {
                  setStockSearchQuery("");
                  setIsSearchOpen(false);
                }}
                className="text-[var(--brand)] font-bold hover:underline cursor-pointer ml-2"
              >
                Clear filter
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Search Button / Inline Search Input */}
            <div className="shrink-0 relative">
              {!isSearchOpen && !stockSearchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 60);
                  }}
                  className="h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] hover:text-[var(--brand)] hover:border-[var(--brand)] hover:bg-[var(--surface-3)] transition-all flex items-center gap-2 text-xs font-bold shadow-xs cursor-pointer group"
                  title={`Search ${BASE_STOCKS.length} tokenized stocks by ticker or name`}
                >
                  <Search size={14} className="text-[var(--brand)] group-hover:scale-110 transition-transform" />
                  <span>Search</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[var(--surface)] text-[var(--ink-dim)] border border-[var(--border-subtle)]">
                    {BASE_STOCKS.length}
                  </span>
                </button>
              ) : (
                <div className="relative flex items-center w-48 sm:w-64 animate-fadeIn">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--brand)] pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search AAPL, NVDA, Tesla..."
                    value={stockSearchQuery}
                    onChange={(e) => setStockSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setStockSearchQuery("");
                        setIsSearchOpen(false);
                      }
                    }}
                    autoFocus
                    className="w-full pl-8 pr-7 py-2 rounded-xl border border-[var(--brand)] bg-[var(--surface)] text-xs font-bold text-[var(--ink)] placeholder:text-[var(--ink-dim)] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setStockSearchQuery("");
                      setIsSearchOpen(false);
                    }}
                    className="absolute right-2 text-[var(--ink-dim)] hover:text-[var(--ink)] p-1 cursor-pointer"
                    title="Close search (Esc)"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Left Scroll Button */}
            <button
              type="button"
              onClick={() => scrollStocks("left")}
              disabled={!canScrollLeft}
              aria-label="Scroll stocks left"
              className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] flex items-center justify-center shrink-0 transition-all ${
                !canScrollLeft
                  ? "opacity-30 cursor-not-allowed pointer-events-none"
                  : "hover:bg-[var(--surface-3)] hover:border-[var(--brand)] hover:text-[var(--brand)] shadow-xs cursor-pointer active:scale-95"
              }`}
              title="Scroll stocks left"
            >
              <ChevronLeft size={18} />
            </button>

            {/* Scrollable Stocks Strip with Edge Gradient Fade Masks */}
            <div className="relative min-w-0 flex-1 flex items-center overflow-hidden">
              {/* Inner Left Gradient Fade Mask */}
              {canScrollLeft && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--surface)] to-transparent pointer-events-none z-10"
                  aria-hidden
                />
              )}

              {/* Stock Pills Track */}
              <div
                ref={stockScrollRef}
                onWheel={(e) => {
                  if (e.deltaY !== 0 && stockScrollRef.current) {
                    stockScrollRef.current.scrollLeft += e.deltaY;
                  }
                }}
                className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar scrollbar-none touch-scroll-x w-full"
              >
                {filteredStocks.length === 0 ? (
                  <div className="text-xs text-[var(--ink-dim)] py-2 px-3 italic flex items-center gap-2">
                    <span>No stocks matching &quot;{stockSearchQuery}&quot;</span>
                    <button
                      type="button"
                      onClick={() => setStockSearchQuery("")}
                      className="text-[var(--brand)] font-bold hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  filteredStocks.map((stk) => {
                    const isSel = stk.symbol.toLowerCase() === selectedStockSymbol.toLowerCase();
                    return (
                      <button
                        key={stk.symbol}
                        data-stock-symbol={stk.symbol.toLowerCase()}
                        type="button"
                        onClick={() => setSelectedStockSymbol(stk.symbol)}
                        className={`pop-pill shrink-0 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 select-none cursor-pointer ${
                          isSel
                            ? "bg-[var(--brand)] text-white shadow-sm shadow-blue-500/20 scale-[1.02]"
                            : "border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--border-strong)]"
                        }`}
                      >
                        <span className="font-mono font-bold">{stk.symbol}</span>
                        <span className={`text-[10px] hidden sm:inline ${isSel ? "text-white/80" : "text-[var(--ink-dim)]"}`}>
                          {stk.name}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Inner Right Gradient Fade Mask */}
              {canScrollRight && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--surface)] to-transparent pointer-events-none z-10"
                  aria-hidden
                />
              )}
            </div>

            {/* Right Scroll Button */}
            <button
              type="button"
              onClick={() => scrollStocks("right")}
              disabled={!canScrollRight}
              aria-label="Scroll stocks right"
              className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] flex items-center justify-center shrink-0 transition-all group ${
                !canScrollRight
                  ? "opacity-30 cursor-not-allowed pointer-events-none"
                  : "hover:bg-[var(--surface-3)] hover:border-[var(--brand)] hover:text-[var(--brand)] shadow-xs cursor-pointer active:scale-95"
              }`}
              title="Scroll stocks right"
            >
              <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* 2. Connected Filter & Sorting Controls (integrated in the same deck) */}
        <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Left: Quick Actions + Protocol Category Filters */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Primary Quick Actions */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("supply");
                setSortBy("best_supply");
              }}
              className={`pop-pill px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "supply" && sortBy === "best_supply"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20"
              }`}
            >
              <TrendingUp size={13} />
              <span>Best Supply APY</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("borrow");
                setSortBy("best_borrow");
              }}
              className={`pop-pill px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "borrow" && sortBy === "best_borrow"
                  ? "bg-[var(--brand)] text-white shadow-xs"
                  : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25 hover:bg-blue-500/20"
              }`}
            >
              <Lock size={13} />
              <span>Lowest Borrow APR</span>
            </button>

            <span className="text-[var(--border-strong)] hidden sm:inline">|</span>

            {/* Secondary Category Filters */}
            <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-xl border border-[var(--border-subtle)] overflow-x-auto no-scrollbar">
              {[
                { id: "all", label: "All Protocols" },
                { id: "supply", label: "Supply & Yield" },
                { id: "borrow", label: "Borrow USDC" },
                { id: "strategies", label: "Carry Strategies" },
              ].map((tab) => {
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as FilterTab)}
                    className={`pop-pill px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs border border-[var(--border-strong)]"
                        : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Sort Options next to filters */}
          <div className="flex items-center gap-1.5 self-end lg:self-auto overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-[var(--ink-dim)] flex items-center gap-1 shrink-0">
              <SlidersHorizontal size={12} /> Sort:
            </span>
            {[
              { id: "best_supply" as const, label: "Top APY" },
              { id: "best_borrow" as const, label: "Low APR" },
              { id: "liquidity" as const, label: "Liquidity" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSortBy(s.id)}
                className={`pop-pill px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  sortBy === s.id
                    ? "bg-[var(--brand)] text-white shadow-xs"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Best-in-Class Highlights for Current Stock */}
      {comparison && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Best Supply APY */}
          <div className="pop rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Top Supply Yield
              </p>
              <p className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                {comparison.bestSupplyOption?.supplyApy.toFixed(2)}% APY
              </p>
              <p className="text-xs text-[var(--ink)] font-bold mt-0.5 truncate">
                {comparison.bestSupplyOption?.protocolName}
              </p>
            </div>
            {comparison.bestSupplyOption && (
              <button
                type="button"
                onClick={() => handleOpenAction(comparison.bestSupplyOption!, "supply")}
                className="btn-primary shrink-0 py-2 px-3 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <span>Supply</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>

          {/* Lowest Borrow APR */}
          <div className="pop rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand-soft)] p-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-dark)]">
                Lowest Borrow Rate
              </p>
              <p className="font-mono text-2xl font-black text-[var(--brand-dark)] mt-0.5 tabular-nums">
                {comparison.bestBorrowOption?.borrowApr !== null && comparison.bestBorrowOption?.borrowApr !== undefined
                  ? `${comparison.bestBorrowOption.borrowApr.toFixed(2)}% APR`
                  : "N/A"}
              </p>
              <p className="text-xs text-[var(--ink)] font-bold mt-0.5 truncate">
                {comparison.bestBorrowOption?.protocolName}
              </p>
            </div>
            {comparison.bestBorrowOption && (
              <button
                type="button"
                onClick={() => handleOpenAction(comparison.bestBorrowOption!, "borrow")}
                className="btn-primary shrink-0 py-2 px-3 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <span>Borrow</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>

          {/* Deepest Liquidity */}
          <div className="pop rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">
                Deepest Available Pool
              </p>
              <p className="font-mono text-2xl font-black text-[var(--ink)] mt-0.5 tabular-nums">
                ${((comparison.highestLiquidityOption?.availableLiquidityUsd ?? 0) / 1e6).toFixed(1)}M
              </p>
              <p className="text-xs text-[var(--ink-muted)] font-semibold mt-0.5 truncate">
                {comparison.highestLiquidityOption?.protocolName}
              </p>
            </div>
            {comparison.highestLiquidityOption && (
              <button
                type="button"
                onClick={() => handleOpenAction(comparison.highestLiquidityOption!, "supply")}
                className="btn-secondary shrink-0 py-2 px-3 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>Compare</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Simplified, High-Contrast Options Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-2xl skeleton-shimmer border border-[var(--border-subtle)]" />
          ))
        ) : sortedAndFilteredOptions.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-12 text-center text-xs text-[var(--ink-muted)]">
            No lending options found matching the selected filter.
          </div>
        ) : (
          sortedAndFilteredOptions.map((opt, idx) => {
            const isRankOne = idx === 0;
            const optIsStrategy = opt.type === "strategy";
            const actionDetails = getActionDetails(opt);
            const ActionIcon = actionDetails.icon;

            const rankOneBadgeLabel =
              sortBy === "best_supply"
                ? "Top Supply Yield"
                : sortBy === "best_borrow"
                  ? "Lowest Borrow Cost"
                  : "Deepest Pool";

            return (
              <motion.div
                key={opt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.02, ease: [0.16, 1, 0.3, 1] }}
                className={`pop-lg rounded-2xl border p-5 shadow-[var(--shadow-card)] flex flex-col justify-between transition-all space-y-4 ${
                  isRankOne
                    ? "border-[var(--brand)] bg-[var(--surface)] ring-2 ring-[var(--brand)]/20 shadow-md"
                    : "border border-[var(--border-subtle)] bg-[var(--surface)]"
                }`}
              >
                <div className="space-y-3.5">
                  {/* Card Header: Protocol Name + Type Badge + Top Option Highlight */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-black text-base text-[var(--ink)] leading-snug truncate">
                          {opt.protocolName}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] uppercase tracking-wide">
                          {opt.type === "strategy" ? "Auto-Carry Vault" : opt.typeLabel}
                        </span>
                      </div>
                    </div>

                    {/* Prominent Best Option Badge */}
                    {isRankOne && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--brand)] text-white shadow-xs">
                        ★ {rankOneBadgeLabel}
                      </span>
                    )}
                  </div>

                  {/* Hero Metrics: Big, Clear Supply APY and Borrow APR */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-[var(--surface-2)] p-3 border border-[var(--border-subtle)]">
                      <p className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] font-bold">
                        Supply APY
                      </p>
                      <p className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                        {opt.supplyApy.toFixed(2)}%
                      </p>
                      <p className="text-[10px] text-[var(--ink-muted)] mt-0.5 font-medium truncate">
                        {optIsStrategy ? "Auto-Compounding" : "Securities Yield"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[var(--surface-2)] p-3 border border-[var(--border-subtle)]">
                      <p className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] font-bold">
                        Borrow APR
                      </p>
                      <p className="font-mono text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
                        {opt.borrowApr !== null ? `${opt.borrowApr.toFixed(2)}%` : "N/A"}
                      </p>
                      <p className="text-[10px] text-[var(--ink-muted)] mt-0.5 font-medium truncate">
                        {opt.borrowApr !== null ? "USDC Loan Rate" : "Collateral Only"}
                      </p>
                    </div>
                  </div>

                  {/* Compact Parameters Row: Max LTV, Available Liquidity, Risk */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] text-[11px]">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-[var(--ink-dim)]">Max LTV</p>
                      <p className="font-mono font-bold text-[var(--ink)] mt-0.5">
                        {opt.maxLtv !== null ? `${opt.maxLtv}%` : "Vault"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-[var(--ink-dim)]">Available Liq</p>
                      <p className="font-mono font-bold text-[var(--ink)] mt-0.5">
                        ${(opt.availableLiquidityUsd / 1e6).toFixed(1)}M
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-[var(--ink-dim)]">Risk Rating</p>
                      <p className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                        {opt.riskLevel.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Concise Risk Note (preventing overflow with clean truncate) */}
                  {opt.riskNotes?.[0] && (
                    <p className="text-[11px] text-[var(--ink-muted)] truncate" title={opt.riskNotes[0]}>
                      {opt.riskNotes[0]}
                    </p>
                  )}
                </div>

                {/* One Clear Action Button */}
                <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAction(opt, actionDetails.action)}
                    className="btn-primary w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.99] cursor-pointer"
                  >
                    <ActionIcon size={14} />
                    <span>{actionDetails.label}</span>
                    <ArrowRight size={13} className="opacity-75" />
                  </button>

                  {/* Secondary Action Option */}
                  {!optIsStrategy && opt.borrowApr !== null && (
                    <div className="flex items-center justify-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleOpenAction(opt, actionDetails.action === "borrow" ? "supply" : "borrow")}
                        className="text-[var(--ink-muted)] hover:text-[var(--brand)] font-semibold transition-colors cursor-pointer"
                      >
                        {actionDetails.action === "borrow" ? `or Supply ${currentStock.symbol}` : "or Borrow USDC"}
                      </button>
                      <span className="text-[var(--border-strong)]">·</span>
                      <button
                        type="button"
                        onClick={() => handleOpenAction(opt, "repay")}
                        className="text-[var(--ink-dim)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                      >
                        Repay
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Modal comparison */}
      {comparisonModalStock && (
        <StockDetailComparisonModal
          stock={comparisonModalStock}
          userAddress={userAddress}
          connType={connType}
          initialOptionId={modalOptionId}
          initialAction={modalAction}
          onClose={() => {
            setComparisonModalStock(null);
            setModalOptionId(null);
            setModalAction(null);
          }}
          onRequestConnect={onRequestConnect}
          onSuccess={() => {
            showToast("Transaction successfully submitted to Base!", "");
            loadData();
          }}
        />
      )}
    </div>
  );
}
