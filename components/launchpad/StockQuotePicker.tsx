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
  ChevronDown,
} from "lucide-react";
import {
  TOKENIZED_STOCKS_REGISTRY,
  type TokenizedStockEntry,
  type StockCategory,
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
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

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
    setMobileSheetOpen(false);
  };

  const handleCopy = async (addr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(addr);
    if (ok) {
      setCopiedAddr(addr);
      setTimeout(() => setCopiedAddr(null), 2000);
    }
  };

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

  const categoryTabs: Array<StockCategory | "All"> = [
    "All",
    "Tech",
    "Finance",
    "Consumer",
    "Crypto-related",
    "Healthcare",
  ];

  const filteredStocks = useMemo(() => {
    let list = [...TOKENIZED_STOCKS_REGISTRY];

    if (selectedCategory !== "All") {
      list = list.filter((s) => s.category === selectedCategory);
    }

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
      ) ?? TOKENIZED_STOCKS_REGISTRY[1]
    );
  }, [selectedStock.address]);

  const selectedLivePrice = stockPrices[selectedStock.symbol];

  // Stock List Row Render
  const renderStockItem = (stock: TokenizedStockEntry) => {
    const isSelected = selectedStock.address.toLowerCase() === stock.address.toLowerCase();
    const isFav = favorites.includes(stock.symbol);
    const { eligible, reason } = checkEligibility(stock);
    const livePrice = stockPrices[stock.symbol];
    const isInfoActive = activeInfoSymbol === stock.symbol;

    return (
      <div
        key={stock.symbol}
        className={`relative transition select-none ${
          !eligible
            ? "opacity-50 cursor-not-allowed bg-[var(--surface-3)]/30"
            : isSelected
              ? "bg-[var(--brand-soft)] border-l-4 border-l-[var(--brand-text)]"
              : "hover:bg-[var(--surface-2)]"
        }`}
      >
        <div
          onClick={() => eligible && handleSelect(stock)}
          className="px-3.5 py-3 flex items-center justify-between gap-2.5 cursor-pointer min-h-[48px]"
        >
          {/* Left: Star, Logo, Ticker & Company */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={(e) => toggleFavorite(stock.symbol, e)}
              className={`p-1.5 rounded hover:bg-[var(--surface)] transition min-w-[28px] min-h-[28px] flex items-center justify-center shrink-0 ${
                isFav
                  ? "text-amber-500 fill-amber-500"
                  : "text-[var(--ink-dim)] hover:text-amber-500"
              }`}
              title={isFav ? "Remove from favorites" : "Add to favorites"}
              aria-label={`Favorite ${stock.symbol}`}
            >
              <Star size={14} fill={isFav ? "currentColor" : "none"} />
            </button>

            <TokenLogo
              address={stock.address}
              symbol={stock.symbol}
              size={28}
              shape="rounded-lg"
              src={stock.logo}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-bold text-xs text-[var(--ink)]">
                  {stock.symbol}
                </span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
                  {stock.category}
                </span>
                <span className="text-[9px] font-semibold text-[var(--ink-dim)] hidden min-[360px]:inline">
                  {stock.issuer}
                </span>
              </div>
              <p className="text-[11px] text-[var(--ink-muted)] truncate max-w-full">
                {stock.name}
              </p>
            </div>
          </div>

          {/* Right: Price & Selection Checkmark */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className="font-mono font-bold text-xs text-[var(--ink)]">
                {livePrice ? `$${livePrice.toFixed(2)}` : "Live Feed"}
              </p>
              {eligible ? (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                  Pair Ready
                </span>
              ) : (
                <span
                  className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block"
                  title={reason}
                >
                  {reason ?? "Ineligible"}
                </span>
              )}
            </div>

            {/* Info Trigger Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveInfoSymbol(isInfoActive ? null : stock.symbol);
              }}
              className="p-1.5 rounded text-[var(--ink-muted)] hover:text-[var(--brand-text)] min-w-[28px] min-h-[28px] flex items-center justify-center shrink-0"
              title="View details"
              aria-label={`Details for ${stock.symbol}`}
            >
              <Info size={14} />
            </button>

            {isSelected && (
              <span className="w-5 h-5 rounded-full bg-[var(--brand)] text-white flex items-center justify-center shrink-0">
                <Check size={11} strokeWidth={3} />
              </span>
            )}
          </div>
        </div>

        {/* Inline Detail Accordion (never overflows off screen!) */}
        {isInfoActive && (
          <div className="px-3.5 pb-3 pt-1 border-t border-[var(--border-subtle)]/50 bg-[var(--surface-3)]/40 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-[var(--ink)]">
              <span>{stock.name} ({stock.underlyingTicker})</span>
              <span className="text-[10px] text-[var(--ink-muted)] font-mono">Decimals: {stock.decimals}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)] font-mono text-[10px] gap-2">
              <span className="truncate flex-1 min-w-0">{stock.address}</span>
              <button
                type="button"
                onClick={(e) => handleCopy(stock.address, e)}
                className="text-[var(--brand-text)] hover:underline shrink-0 flex items-center gap-1 font-bold"
              >
                {copiedAddr === stock.address ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
              <span>Custody Issuer: <strong className="text-[var(--ink)]">{stock.issuer}</strong></span>
              <span>Feed: <strong className="text-[var(--ink)]">{stock.priceFeed.type}</strong></span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5 space-y-4 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-[var(--ink-muted)]">
            Quote Asset (Base Tokenized Stock)
          </label>
          <p className="text-xs text-[var(--ink-dim)] mt-0.5">
            Pair your token directly against tokenized equity on Uniswap V3 or Aerodrome
          </p>
        </div>

        {/* Market Hours Indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              isMarketOpen
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            }`}
          >
            <Clock size={12} className="shrink-0" />
            <span>Chainlink 24/5: {isMarketOpen ? "Market Open" : "Market Closed"}</span>
          </span>
        </div>
      </div>

      {/* MOBILE SELECTED STOCK CARD WITH BOTTOM SHEET TRIGGER */}
      <div className="block md:hidden space-y-3">
        <div
          onClick={() => setMobileSheetOpen(true)}
          className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--brand)] transition min-h-[56px]"
          role="button"
          tabIndex={0}
          aria-label="Change quote stock asset"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <TokenLogo
              address={selectedStock.address}
              symbol={selectedStock.symbol}
              size={36}
              shape="rounded-xl"
              src={selectedStock.logo}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-black text-sm text-[var(--ink)]">
                  {selectedStock.symbol}
                </span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--brand-text)] border border-[var(--border-subtle)]">
                  {selectedStock.category}
                </span>
              </div>
              <p className="text-xs text-[var(--ink-muted)] truncate">
                {selectedStock.name}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="font-mono font-bold text-xs text-[var(--ink)]">
              {selectedLivePrice ? `$${selectedLivePrice.toFixed(2)}` : "Live Feed"}
            </p>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--brand-text)] mt-0.5">
              Change <ChevronDown size={12} />
            </span>
          </div>
        </div>

        {/* Mobile Full Bottom Sheet / Modal */}
        {mobileSheetOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div
              className="w-full bg-[var(--surface)] border-t border-[var(--border-subtle)] rounded-t-3xl p-4 max-h-[85dvh] flex flex-col shadow-2xl animate-meridian-rise pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle & Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <h3 className="text-base font-black text-[var(--ink)]">Select Quote Asset</h3>
                  <p className="text-xs text-[var(--ink-muted)]">32+ tokenized stocks available</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSheetOpen(false)}
                  className="p-2 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] bg-[var(--surface-2)] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  aria-label="Close quote asset picker"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search input (>= 16px font to prevent iOS zoom) */}
              <div className="pt-3 pb-2">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none"
                  />
                  <input
                    type="text"
                    placeholder="Search ticker, company or address…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-base text-[var(--ink)] placeholder-[var(--ink-dim)] focus:outline-none focus:border-[var(--brand-text)]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] min-h-[32px] min-w-[32px] flex items-center justify-center"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2 -my-1 touch-scroll-x">
                {categoryTabs.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`pop-pill px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap min-h-[36px] ${
                      selectedCategory === cat
                        ? "bg-[var(--brand)] text-white shadow-xs"
                        : "bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    {cat === "All" ? "All Sectors" : cat}
                  </button>
                ))}
              </div>

              {/* Stock List inside Sheet */}
              <div className="flex-1 overflow-y-auto mt-2 rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]/60 min-h-0">
                {filteredStocks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[var(--ink-muted)]">
                    No tokenized stocks found matching &ldquo;{searchQuery}&rdquo;.
                  </div>
                ) : (
                  filteredStocks.map((stock) => renderStockItem(stock))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP SEARCH & LIST CONTAINER (hidden on mobile, exactly preserves desktop layout) */}
      <div className="hidden md:block space-y-3">
        {/* Search Input & Category Filter Chips */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none"
            />
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

        {/* Scrollable Stock List */}
        <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/40 divide-y divide-[var(--border-subtle)]/60">
          {filteredStocks.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--ink-muted)]">
              No tokenized stocks found matching &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            filteredStocks.map((stock) => renderStockItem(stock))
          )}
        </div>
      </div>

      {/* Selected Stock Summary Bar (Responsive with wrapping text) */}
      <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex flex-col gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-bold text-[var(--ink)] shrink-0">Pair Target:</span>
          <span className="font-mono text-[var(--brand-text)] font-black text-sm break-all">
            TOKEN / {selectedStock.symbol}
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[var(--surface)] text-[var(--ink-muted)] border border-[var(--border-subtle)] shrink-0">
            Issuer: {selectedStockEntry.issuer}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-muted)] min-w-0 pt-1 border-t border-[var(--border-subtle)]/50">
          <span className="shrink-0">Quote Contract:</span>
          <span className="font-mono text-[var(--ink)] font-semibold truncate">
            {selectedStock.address.slice(0, 10)}…{selectedStock.address.slice(-6)}
          </span>
          <button
            type="button"
            onClick={(e) => handleCopy(selectedStock.address, e)}
            className="p-1 rounded hover:text-[var(--brand-text)] text-[var(--ink-muted)] flex items-center gap-1 shrink-0"
            title="Copy address"
          >
            <Copy size={12} />
            <span className="text-[10px]">{copiedAddr === selectedStock.address ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Stock-paired Risk Disclosure */}
      <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold">
          <AlertTriangle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Stock-Paired Volatility &amp; Issuer Disclosure</span>
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
