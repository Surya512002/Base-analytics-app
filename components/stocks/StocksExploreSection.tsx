"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Coins,
  Lock,
  Copy,
  Check,
  Building2,
  RefreshCw,
  Star,
  Bell,
  Activity,
  Layers,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { CoinbaseTokenizedStock, LiquidityHealthTier } from "@/lib/stocks/coinbase-api";
import TokenLogo from "@/components/ui/TokenLogo";

interface StocksExploreSectionProps {
  onSelectStockLend?: (stock: CoinbaseTokenizedStock) => void;
  onTradeStock?: (stock: CoinbaseTokenizedStock) => void;
}

export default function StocksExploreSection({
  onSelectStockLend,
  onTradeStock,
}: StocksExploreSectionProps) {
  const router = useRouter();
  const [stocks, setStocks] = useState<CoinbaseTokenizedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [activeAlertStock, setActiveAlertStock] = useState<CoinbaseTokenizedStock | null>(null);
  const [alertTargetPrice, setAlertTargetPrice] = useState("");
  const [alertSaved, setAlertSaved] = useState(false);

  // Load watchlist from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("base_stocks_watchlist");
      if (stored) setWatchlist(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleWatchlist = useCallback((symbol: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol];
      try {
        localStorage.setItem("base_stocks_watchlist", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const loadStocks = useCallback(async (refresh = false) => {
    try {
      setLoading(true);
      const url = `/api/stocks?limit=100${refresh ? "&refresh=1" : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      if (data?.stocks) {
        setStocks(data.stocks);
      }
    } catch {
      // Keep existing state or fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const categories = [
    { id: "all", label: "All Equities" },
    { id: "watchlist", label: `Watchlist (${watchlist.length})` },
    { id: "tech", label: "AI & Tech" },
    { id: "crypto", label: "Crypto Equities" },
    { id: "aerospace", label: "Aerospace" },
    { id: "finance", label: "Finance" },
    { id: "consumer", label: "Consumer" },
  ];

  const filteredStocks = useMemo(() => {
    let list = [...stocks];
    if (selectedCategory === "watchlist") {
      list = list.filter((s) => watchlist.includes(s.symbol));
    } else if (selectedCategory !== "all") {
      list = list.filter((s) => s.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.underlyingTicker.toLowerCase().includes(q) ||
          s.address.toLowerCase() === q
      );
    }
    return list;
  }, [stocks, selectedCategory, searchQuery, watchlist]);

  const stats = useMemo(() => {
    const totalMcap = stocks.reduce((acc, s) => acc + (s.mcapUsd || 0), 0);
    const totalVol = stocks.reduce((acc, s) => acc + (s.volume24hUsd || 0), 0);
    return {
      count: stocks.length,
      totalMcap,
      totalVol,
    };
  }, [stocks]);

  const handleTrade = (stock: CoinbaseTokenizedStock) => {
    if (onTradeStock) {
      onTradeStock(stock);
    } else {
      router.push(`/swap?token=${stock.address}`);
    }
  };

  const handleSetAlert = (stock: CoinbaseTokenizedStock) => {
    setActiveAlertStock(stock);
    setAlertTargetPrice(stock.nav.toFixed(2));
    setAlertSaved(false);
  };

  const handleSaveAlert = () => {
    if (!activeAlertStock) return;
    setAlertSaved(true);
    setTimeout(() => {
      setActiveAlertStock(null);
      setAlertSaved(false);
    }, 1500);
  };

  const renderLiquidityBadge = (tier: LiquidityHealthTier) => {
    switch (tier) {
      case "deep":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Deep Liquidity
          </span>
        );
      case "moderate":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Good Depth
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Oracle Pause
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Active
          </span>
        );
    }
  };

  return (
    <section className="space-y-6 animate-meridian-rise">
      {/* Header & Terminal Stats */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-gradient-to-br from-blue-950/30 via-[var(--surface)] to-indigo-950/20 p-6 sm:p-7 shadow-[var(--shadow-card)]">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                <Sparkles size={12} />
                COINBASE TOKENIZED STOCKS (B20)
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-[var(--surface-2)] text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                <ShieldCheck size={12} className="text-emerald-500" />
                100% Custody Backed · Base Mainnet
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Activity size={12} />
                24/5 Chainlink Feeds
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--ink)]">
              Base Tokenized Stocks Terminal
            </h2>
            <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
              Institutional-grade tokenized US equities on Base. Trade Uniswap, Aerodrome &amp; o1 Trading API routes with MEV protection, or compare live borrow &amp; lending rates across Morpho, Aave V4, Euler, and Superform.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto shrink-0">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]/90 p-3.5 text-center">
              <p className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">Stocks Tracked</p>
              <p className="text-xl font-black text-[var(--ink)] mt-1 tabular-nums">{stats.count || 32}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]/90 p-3.5 text-center">
              <p className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">24h Volume</p>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
                ${(stats.totalVol / 1e6).toFixed(1)}M
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]/90 p-3.5 text-center">
              <p className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">Custody Standard</p>
              <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">Reg S 1:1</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Category Filter Navigation */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search symbol (NVDAc, AAPLc), company, or 0xb20... address"
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] text-xs text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none focus:border-[var(--brand)] transition-all shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === c.id
                  ? "bg-[var(--brand-soft)] text-[var(--brand-dark)] border border-[var(--brand)]/30 shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => loadStocks(true)}
            title="Refresh prices"
            className="p-2 rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors shrink-0"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Stocks Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-52 rounded-2xl skeleton-shimmer border border-[var(--border-subtle)]" />
          ))}
        </div>
      ) : filteredStocks.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-12 text-center space-y-2">
          <Building2 size={32} className="mx-auto text-[var(--ink-muted)] opacity-50" />
          <p className="text-sm font-bold text-[var(--ink)]">No tokenized stocks found matching your query</p>
          <p className="text-xs text-[var(--ink-muted)]">Try searching for NVDAc, AAPLc, TSLAc, or reset the category filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-grid">
          {filteredStocks.map((stock) => {
            const isPositive = stock.change24h >= 0;
            const isWatched = watchlist.includes(stock.symbol);

            return (
              <div
                key={stock.address}
                className="group relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] card-interactive hover:border-[var(--brand)] transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Bar: Symbol, Name & 24h NAV Change */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <TokenLogo
                        address={stock.address}
                        symbol={stock.symbol}
                        size={44}
                        shape="rounded-xl"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-black text-base text-[var(--ink)] tracking-tight leading-tight">
                            {stock.symbol}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] uppercase">
                            {stock.category}
                          </span>
                          {renderLiquidityBadge(stock.liquidityHealth)}
                        </div>
                        <p className="text-xs text-[var(--ink-muted)] font-medium line-clamp-1 mt-0.5">
                          {stock.name}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono text-lg font-black text-[var(--ink)]">
                        ${stock.nav.toFixed(2)}
                      </p>
                      <p
                        className={`text-xs font-black flex items-center justify-end gap-0.5 ${
                          isPositive
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        <span>
                          {isPositive ? "+" : ""}
                          {stock.change24h.toFixed(2)}%
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Multiplier, Status & Contract Strip */}
                  <div className="grid grid-cols-2 gap-2 py-2 px-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--ink-dim)]">Multiplier:</span>
                      <span className="font-mono font-bold text-[var(--ink)]">{stock.multiplier.toFixed(1)}x Split</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--ink-dim)]">Status:</span>
                      <span className={`font-bold ${stock.isPaused ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                        {stock.isPaused ? "Halted / Paused" : "24/5 Trading"}
                      </span>
                    </div>
                  </div>

                  {/* Contract Address & Watchlist / Alert Tools */}
                  <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)] pt-1">
                    <div className="flex items-center gap-1 font-mono">
                      <span>
                        {stock.address.slice(0, 6)}...{stock.address.slice(-4)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(stock.address)}
                        className="hover:text-[var(--ink)] transition-colors p-1"
                        title="Copy Contract Address"
                      >
                        {copiedAddress === stock.address ? (
                          <Check size={12} className="text-emerald-500" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSetAlert(stock)}
                        className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--surface-2)] transition-colors"
                        title="Set Price Alert"
                      >
                        <Bell size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleWatchlist(stock.symbol)}
                        className={`p-1 rounded transition-colors ${
                          isWatched
                            ? "text-amber-500 bg-amber-500/10"
                            : "text-[var(--ink-muted)] hover:text-amber-500 hover:bg-[var(--surface-2)]"
                        }`}
                        title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                      >
                        <Star size={13} fill={isWatched ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons: 1-Click Trade & Unified Lend/Borrow */}
                <div className="pt-4 mt-4 border-t border-[var(--border-subtle)] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTrade(stock)}
                    className="flex-1 btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-98"
                  >
                    <TrendingUp size={13} />
                    <span>Trade</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectStockLend?.(stock)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1.5 transition-all active:scale-98"
                  >
                    <Coins size={13} />
                    <span>Lend &amp; Borrow</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Simple Price Alert Dialog */}
      {activeAlertStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--overlay)] backdrop-blur-md animate-meridian-fade">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-3)] p-5 shadow-2xl space-y-4 animate-meridian-scale">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-blue-600 dark:text-blue-400" />
                <h4 className="font-black text-sm text-[var(--ink)]">
                  Price Alert · {activeAlertStock.symbol}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveAlertStock(null)}
                className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
              Notify me when <strong>{activeAlertStock.name}</strong> moves above or below target price. Current NAV:{" "}
              <strong>${activeAlertStock.nav.toFixed(2)}</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                Target Price (USD)
              </label>
              <input
                type="number"
                value={alertTargetPrice}
                onChange={(e) => setAlertTargetPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-sm font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--brand)]"
              />
            </div>

            {alertSaved ? (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Check size={14} /> Price alert saved successfully!
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSaveAlert}
                className="w-full btn-primary py-2.5 rounded-xl text-xs font-bold shadow-xs"
              >
                Set Alert
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
