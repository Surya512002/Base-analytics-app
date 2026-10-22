"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  X,
  Check,
  Star,
  Clock,
  AlertTriangle,
  Info,
  Copy,
  ExternalLink,
  ShieldCheck,
  Ban,
} from "lucide-react";
import {
  TOKENIZED_STOCKS_REGISTRY,
  type TokenizedStockEntry,
  type StockCategory,
  getActiveTokenizedStocks,
} from "@/lib/stocks/tokenized-stocks-registry";
import type { BaseStock } from "@/lib/stocks/base-stocks";
import { isUSMarketOpenNow } from "@/lib/launchpad/launch-configs";
import { copyToClipboard } from "@/lib/utils/clipboard";
import TokenLogo from "@/components/ui/TokenLogo";

interface StockQuotePickerProps {
  selectedStock: BaseStock;
  onSelectStock: (stock: BaseStock) => void;
  stockPrices?: Record<string, number>;
}

const RECENT_KEY = "base_launch_recent_quotes";
const FAVORITES_KEY = "base_launch_favorite_quotes";

export default function StockQuotePicker({
  selectedStock,
  onSelectStock,
  stockPrices = {},
}: StockQuotePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<StockCategory | "All">("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [activeInfoSymbol, setActiveInfoSymbol] = useState<string | null>(null);

  const isMarketOpen = isUSMarketOpenNow();

  // Load favorites & recents on mount
  useEffect(() => {
    try {
      const favs = localStorage.getItem(FAVORITES_KEY);
      if (favs) setFavorites(JSON.parse(favs));
      const rec = localStorage.getItem(RECENT_KEY);
      if (rec) setRecents(JSON.parse(rec));
    } catch {
      // ignore
    }
  }, []);

  const toggleFavorite = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSelect = (stock: TokenizedStockEntry) => {
    // Record to recents
    setRecents((prev) => {
      const next = [stock.symbol, ...prev.filter((s) => s !== stock.symbol)].slice(0, 8);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    onSelectStock({
      symbol: stock.symbol,
      name: stock.name,
      address: stock.address,
      feed: stock.priceFeed.address ?? null,
      decimals: stock.decimals,
      category: stock.category.toLowerCase(),
      underlyingTicker: stock.underlyingTicker,
      issuer: stock.issuer,
      logo: stock.logo,
      status: stock.status,
      addedAt: stock.addedAt,
    });
  };

  const handleCopy = async (addr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(addr);
    if (ok) {
      setCopiedAddr(addr);
      setTimeout(() => setCopiedAddr(null), 2000);
    }
  };

  // Eligibility check per stock
  const checkEligibility = (stock: TokenizedStockEntry): { eligible: boolean; reason?: string } => {
    if (stock.status !== "active") {
      return { eligible: false, reason: `Status: ${stock.status} (Not active for pairing)` };
    }
    if (stock.decimals !== 8 && stock.decimals !== 6 && stock.decimals !== 18) {
      return { eligible: false, reason: "Unsupported token decimals" };
    }
    if (!stock.priceFeed || !stock.priceFeed.type) {
      return { eligible: false, reason: "Missing verified USD price source" };
    }
    return { eligible: true };
  };

  // Dynamic categories list
  const categoryTabs: Array<StockCategory | "All"> = [
    "All",
    "Tech",
    "Finance",
    "Consumer",
    "Crypto-related",
    "Healthcare",
  ];

  // Filtered stocks list
  const filteredStocks = useMemo(() => {
    let list = [...TOKENIZED_STOCKS_REGISTRY];

    // Category filter
    if (selectedCategory !== "All") {
      list = list.filter((s) => s.category === selectedCategory);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.underlyingTicker.toLowerCase().includes(q) ||
          s.address.toLowerCase() === q
      );
    }

    // Sort: Favorites first, then recents, then symbol
    list.sort((a, b) => {
      const aFav = favorites.includes(a.symbol) ? 1 : 0;
      const bFav = favorites.includes(b.symbol) ? 1 : 0;
      if (bFav !== aFav) return bFav - aFav;

      const aRec = recents.indexOf(a.symbol);
      const bRec = recents.indexOf(b.symbol);
      if (aRec !== -1 && bRec !== -1) return aRec - bRec;
      if (aRec !== -1) return -1;
      if (bRec !== -1) return 1;

      return a.symbol.localeCompare(b.symbol);
    });

    return list;
  }, [searchQuery, selectedCategory, favorites, recents]);

  const selectedStockEntry = useMemo(() => {
    return (
      TOKENIZED_STOCKS_REGISTRY.find(
        (s) => s.address.toLowerCase() === selectedStock.address.toLowerCase()
      ) ?? TOKENIZED_STOCKS_REGISTRY[0]
    );
  }, [selectedStock.address]);

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-4">
      {/* Header with Title and Market Status chip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h3 className="text-sm font-black text-[var(--ink)] flex items-center gap-1.5">
            <span>Select Tokenized Stock Quote Asset</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--ink-dim)] border border-[var(--border-subtle)]">
              {TOKENIZED_STOCKS_REGISTRY.length} Available
            </span>
          </h3>
          <p className="text-xs text-[var(--ink-muted)]">
            Launch memestocks paired directly against verified equity tokens on Base.
          </p>
        </div>

        {/* Chainlink 24/5 Live Market Hours Chip */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              isMarketOpen
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            }`}
          >
            <Clock size={12} />
            <span>Chainlink 24/5: {isMarketOpen ? "Market Open" : "Market Closed"}</span>
          </span>
        </div>
      </div>

      {/* Search Input & Category Filter Chips */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search 32+ stocks by ticker (e.g. NVDAc), company (e.g. Apple), or 0xb20… address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--ink)] placeholder-[var(--ink-dim)] focus:outline-none focus:border-[var(--brand-text)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -my-1">
          {categoryTabs.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`pop-pill px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-[var(--brand)] text-white shadow-xs"
                  : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--border-subtle)]"
              }`}
            >
              {cat === "All" ? "All Sectors" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Virtualized/Scrollable Fast Stock List Container (max height with high density) */}
      <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/40 divide-y divide-[var(--border-subtle)]/60">
        {filteredStocks.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--ink-muted)]">
            No tokenized stocks found matching &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          filteredStocks.map((stock) => {
            const isSelected = selectedStock.address.toLowerCase() === stock.address.toLowerCase();
            const isFav = favorites.includes(stock.symbol);
            const { eligible, reason } = checkEligibility(stock);
            const livePrice = stockPrices[stock.symbol];

            return (
              <div
                key={stock.symbol}
                onClick={() => eligible && handleSelect(stock)}
                className={`pop-row px-3.5 py-2.5 flex items-center justify-between gap-3 transition select-none ${
                  !eligible
                    ? "opacity-50 cursor-not-allowed bg-[var(--surface-3)]/30"
                    : isSelected
                      ? "bg-[var(--brand-soft)] border-l-4 border-l-[var(--brand-text)] font-medium cursor-pointer"
                      : "hover:bg-[var(--surface-2)] cursor-pointer"
                }`}
              >
                {/* Left: Star, Logo, Ticker & Company */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(stock.symbol, e)}
                    className={`p-1 rounded hover:bg-[var(--surface)] transition ${
                      isFav ? "text-amber-500 fill-amber-500" : "text-[var(--ink-dim)] hover:text-amber-500"
                    }`}
                    title={isFav ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star size={13} fill={isFav ? "currentColor" : "none"} />
                  </button>

                  <TokenLogo
                    address={stock.address}
                    symbol={stock.symbol}
                    size={28}
                    shape="rounded-lg"
                    src={stock.logo}
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-xs text-[var(--ink)]">
                        {stock.symbol}
                      </span>
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-[var(--surface)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
                        {stock.category}
                      </span>
                      <span className="text-[9px] font-semibold text-[var(--ink-dim)]">
                        {stock.issuer}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-muted)] truncate max-w-[200px] sm:max-w-xs">
                      {stock.name}
                    </p>
                  </div>
                </div>

                {/* Right: Live Price, Status & Checkmark */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="font-mono font-bold text-xs text-[var(--ink)]">
                      {livePrice ? `$${livePrice.toFixed(2)}` : "Live Feed"}
                    </p>
                    {eligible ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Pair Ready
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold" title={reason}>
                        {reason ?? "Ineligible"}
                      </span>
                    )}
                  </div>

                  {/* Info Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveInfoSymbol(activeInfoSymbol === stock.symbol ? null : stock.symbol);
                    }}
                    className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--brand-text)]"
                    title="View details"
                  >
                    <Info size={13} />
                  </button>

                  {/* Selection Checkmark */}
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-white flex items-center justify-center shrink-0">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </div>

                {/* Popover on click of info */}
                {activeInfoSymbol === stock.symbol && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute z-30 right-4 p-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-popover)] shadow-xl text-[11px] space-y-2 max-w-xs animate-fadeIn"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--ink)]">{stock.name}</span>
                      <button
                        type="button"
                        onClick={() => setActiveInfoSymbol(null)}
                        className="text-xs text-[var(--ink-muted)] font-bold hover:text-[var(--ink)]"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="font-mono text-[10px] p-1.5 rounded bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-between">
                      <span>{stock.address.slice(0, 10)}…{stock.address.slice(-6)}</span>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(stock.address, e)}
                        className="text-[var(--brand-text)] hover:underline flex items-center gap-1"
                      >
                        <Copy size={11} />
                        <span>{copiedAddr === stock.address ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    {stock.description && <p className="text-[10px] text-[var(--ink-muted)]">{stock.description}</p>}
                    <div className="text-[10px] text-[var(--ink-dim)] space-y-0.5 border-t border-[var(--border-subtle)] pt-1">
                      <p>Issuer: <strong>{stock.issuer}</strong></p>
                      <p>Underlying: <strong>{stock.underlyingTicker}</strong></p>
                      <p>Decimals: <strong>{stock.decimals}</strong></p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Selected Stock Summary Bar */}
      <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--ink)]">Pair Target:</span>
          <span className="font-mono text-[var(--brand-text)] font-black text-sm">
            TOKEN / {selectedStock.symbol}
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[var(--surface)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
            Issuer: {selectedStockEntry.issuer}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[var(--ink-muted)]">
          <span>Quote Contract:</span>
          <span className="font-mono text-[var(--ink)] font-semibold">
            {selectedStock.address.slice(0, 8)}…{selectedStock.address.slice(-4)}
          </span>
          <button
            type="button"
            onClick={(e) => handleCopy(selectedStock.address, e)}
            className="p-1 rounded hover:text-[var(--brand-text)] text-[var(--ink-muted)]"
            title="Copy address"
          >
            <Copy size={12} />
          </button>
        </div>
      </div>

      {/* Stock-paired Risk Disclosure + Issuer Specific Legal Note */}
      <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold">
          <AlertTriangle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Stock-Paired Volatility & Issuer Disclosure</span>
        </div>
        <p className="text-[11px] opacity-95">
          Memestocks paired with tokenized equity trade against real-world custody shares ({selectedStockEntry.issuer}).
          Off-hours liquidity and price discovery may vary when US equity markets are closed.
        </p>
        {selectedStockEntry.restrictions?.legalNote && (
          <p className="text-[10px] opacity-80 border-t border-amber-500/20 pt-1">
            <strong>Issuer Note ({selectedStockEntry.issuer}):</strong> {selectedStockEntry.restrictions.legalNote}
          </p>
        )}
      </div>
    </div>
  );
}
