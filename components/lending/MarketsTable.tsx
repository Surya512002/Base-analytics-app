"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  X,
  ArrowUpDown,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Layers,
  Clock,
} from "lucide-react";
import { isUSMarketOpenNow } from "@/lib/launchpad/launch-configs";
import { getStockCategoryCounts, type StockCategory } from "@/lib/stocks/tokenized-stocks-registry";
import TokenLogo from "@/components/ui/TokenLogo";

export interface AssetMarketRow {
  symbol: string;
  name: string;
  category: string;
  address: `0x${string}`;
  priceUsd: number;
  priceChange24h?: number;
  bestSupplyApy: number;
  bestSupplyProtocol: string;
  bestBorrowApr: number | null;
  bestBorrowProtocol: string | null;
  totalLiquidityUsd: number;
  walletBalance?: number | null;
  walletBalanceUsd?: number | null;
  isNew?: boolean;
  listedProtocols?: string[];
  hasLendingMarket?: boolean;
  riskFlags?: string[];
  oracleVerified?: boolean;
}

interface MarketsTableProps {
  rows: AssetMarketRow[];
  selectedSymbol?: string | null;
  onSelectAsset: (symbol: string) => void;
  isConnected: boolean;
  onRequestConnect?: () => void;
  mode?: "lend" | "borrow" | "stake";
  loading?: boolean;
  showAllStocks?: boolean;
  onToggleShowAllStocks?: (show: boolean) => void;
  protocolErrors?: Record<string, string>;
  onRetryProtocol?: (protocol: string) => void;
  secondsAgo?: number;
}

export default function MarketsTable({
  rows,
  selectedSymbol,
  onSelectAsset,
  isConnected,
  onRequestConnect,
  mode = "lend",
  loading = false,
  showAllStocks = false,
  onToggleShowAllStocks,
  protocolErrors = {},
  onRetryProtocol,
  secondsAgo = 0,
}: MarketsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedProtocol, setSelectedProtocol] = useState<string>("all");

  const protocolFilters = [
    { id: "all", label: "All Protocols" },
    { id: "beefy", label: "Beefy Finance" },
    { id: "aerodrome", label: "Aerodrome" },
    { id: "morpho", label: "Morpho Blue" },
  ];
  const [onlyHoldings, setOnlyHoldings] = useState(false);
  const [sortBy, setSortBy] = useState<"supply" | "borrow" | "liquidity" | "price" | "name">("supply");
  const [sortAsc, setSortAsc] = useState(false);

  const isMarketOpen = isUSMarketOpenNow();

  // Dynamic category derivation
  const categories: Array<{ id: string; label: string }> = [
    { id: "all", label: "All Categories" },
    { id: "tech", label: "Tech" },
    { id: "crypto-related", label: "Crypto-related" },
    { id: "finance", label: "Finance" },
    { id: "consumer", label: "Consumer" },
    { id: "healthcare", label: "Healthcare" },
  ];

  // Filter & Sort
  const filteredRows = useMemo(() => {
    let result = [...rows];

    // Filter out stocks without lending market unless showAllStocks is checked
    if (!showAllStocks) {
      result = result.filter((r) => r.hasLendingMarket !== false);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.address.toLowerCase() === q
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      result = result.filter((r) => r.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    // Only assets user holds
    if (onlyHoldings) {
      result = result.filter((r) => (r.walletBalance ?? 0) > 0);
    }

    // Sorting
    result.sort((a, b) => {
      let diff = 0;
      if (sortBy === "supply") {
        diff = b.bestSupplyApy - a.bestSupplyApy;
      } else if (sortBy === "borrow") {
        diff = (a.bestBorrowApr ?? 999) - (b.bestBorrowApr ?? 999);
      } else if (sortBy === "liquidity") {
        diff = b.totalLiquidityUsd - a.totalLiquidityUsd;
      } else if (sortBy === "price") {
        diff = b.priceUsd - a.priceUsd;
      } else if (sortBy === "name") {
        diff = a.symbol.localeCompare(b.symbol);
      }
      return sortAsc ? -diff : diff;
    });

    return result;
  }, [rows, showAllStocks, searchQuery, selectedCategory, selectedProtocol, onlyHoldings, sortBy, sortAsc]);

  const toggleSort = (field: "supply" | "borrow" | "liquidity" | "price" | "name") => {
    if (sortBy === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortBy(field);
      setSortAsc(field === "borrow" || field === "name");
    }
  };

  const formatCompactUsd = (val: number): string => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  const failedProtocols = Object.entries(protocolErrors).filter(([_, err]) => Boolean(err));

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] overflow-hidden shadow-xs space-y-4 p-4 sm:p-5">
      {/* Protocol Outage Warning Banners (Per-protocol error resilience) */}
      {failedProtocols.length > 0 && (
        <div className="space-y-2">
          {failedProtocols.map(([proto, err]) => (
            <div
              key={proto}
              className="flex items-center justify-between p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  Couldn&apos;t load <strong>{proto.toUpperCase()}</strong>: {err}
                </span>
                <span className="text-[10px] opacity-75">· Other protocols active</span>
              </div>
              {onRetryProtocol && (
                <button
                  type="button"
                  onClick={() => onRetryProtocol(proto)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-bold text-xs cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Toolbar: Search, Categories, Sort, and Toggles */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]">
              <Search size={15} />
            </span>
            <input
              type="text"
              placeholder="Search by asset, ticker (e.g. NVDAc) or company..."
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

          {/* Controls: Show All Stocks toggle, Holdings, Count & Freshness */}
          <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto text-xs">
            {/* Show All Stocks Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[var(--ink)] bg-[var(--surface-2)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)]">
              <input
                type="checkbox"
                checked={showAllStocks}
                onChange={(e) => onToggleShowAllStocks?.(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-[var(--brand)] accent-[var(--brand)] cursor-pointer"
              />
              <span className="font-semibold text-[11px]">Show all stocks</span>
            </label>

            {isConnected && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={onlyHoldings}
                  onChange={(e) => setOnlyHoldings(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[var(--brand)] accent-[var(--brand)] cursor-pointer"
                />
                <span className="font-medium text-[11px]">Holdings only</span>
              </label>
            )}

            <div className="text-[11px] text-[var(--ink-muted)] font-mono flex items-center gap-1">
              <Clock size={11} />
              <span>Updated {secondsAgo}s ago</span>
            </div>
          </div>
        </div>

        {/* Protocol & Category Filter Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)]">
          {/* Protocol Filter */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            <span className="text-[11px] font-bold text-[var(--ink-dim)] uppercase mr-1">Protocol:</span>
            {protocolFilters.map((p) => {
              const isSelected = selectedProtocol === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedProtocol(p.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none ${
                    isSelected
                      ? p.id === "beefy"
                        ? "bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
                        : "bg-[#0052FF] text-white hover:bg-[#0045D8] shadow-sm"
                      : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] border border-[var(--border-subtle)]"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            <span className="text-[11px] font-bold text-[var(--ink-dim)] uppercase mr-1">Sector:</span>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap cursor-pointer select-none ${
                    isSelected
                      ? "bg-[#0052FF] text-white hover:bg-[#0045D8] shadow-sm"
                      : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] border border-[var(--border-subtle)]"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Table View (Desktop) & Cards (Mobile) */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse hidden md:table">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[11px] font-black uppercase tracking-wider text-[var(--ink-muted)]">
              <th
                onClick={() => toggleSort("name")}
                className="py-3 px-3 cursor-pointer hover:text-[var(--ink)] select-none"
              >
                <span className="inline-flex items-center gap-1">Asset <ArrowUpDown size={11} /></span>
              </th>
              <th
                onClick={() => toggleSort("price")}
                className="py-3 px-3 cursor-pointer hover:text-[var(--ink)] select-none"
              >
                <span className="inline-flex items-center gap-1">Price <ArrowUpDown size={11} /></span>
              </th>
              <th
                onClick={() => toggleSort("supply")}
                className="py-3 px-3 cursor-pointer hover:text-[var(--ink)] select-none"
              >
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  Best Supply APY <ArrowUpDown size={11} />
                </span>
              </th>
              <th
                onClick={() => toggleSort("borrow")}
                className="py-3 px-3 cursor-pointer hover:text-[var(--ink)] select-none"
              >
                <span className="inline-flex items-center gap-1">Best Borrow APR <ArrowUpDown size={11} /></span>
              </th>
              <th
                onClick={() => toggleSort("liquidity")}
                className="py-3 px-3 cursor-pointer hover:text-[var(--ink)] select-none"
              >
                <span className="inline-flex items-center gap-1">Total Liquidity <ArrowUpDown size={11} /></span>
              </th>
              <th className="py-3 px-3">Listed On</th>
              <th className="py-3 px-3">Your Balance</th>
              <th className="py-3 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]/60 text-xs">
            {filteredRows.map((row) => {
              const isSelected = selectedSymbol?.toLowerCase() === row.symbol.toLowerCase();
              const hasMarket = row.hasLendingMarket !== false;
              const hasOracleWarning = row.riskFlags?.includes("UNKNOWN_ORACLE");

              return (
                <tr
                  key={row.symbol}
                  onClick={() => onSelectAsset(row.symbol)}
                  className={`pop-row group transition cursor-pointer ${
                    isSelected ? "bg-[var(--brand-soft)] font-medium" : ""
                  }`}
                >
                  {/* Asset info + New badge */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3">
                      <TokenLogo
                        address={row.address}
                        symbol={row.symbol}
                        size={32}
                        shape="rounded-xl"
                        className="group-hover:border-[var(--brand)] transition"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-sm text-[var(--ink)]">{row.symbol}</span>
                          {row.isNew && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--border-subtle)]">
                              <Sparkles size={9} /> NEW
                            </span>
                          )}
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
                            {row.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--ink-muted)] truncate max-w-[140px]">{row.name}</p>
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-3 px-3 font-mono font-bold text-[var(--ink)]">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? "bg-emerald-500" : "bg-amber-500"}`}
                        title={isMarketOpen ? "Chainlink 24/5 Live Feed Active" : "US Market Closed"}
                      />
                      <span>${row.priceUsd.toFixed(2)}</span>
                    </div>
                  </td>

                  {/* Best Supply APY */}
                  {/* Best Supply APY */}
                  <td className="py-3 px-3">
                    {hasMarket ? (
                      <div>
                        <p className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                          {row.bestSupplyApy > 0 ? `${row.bestSupplyApy.toFixed(2)}%` : "—"}
                        </p>
                        <p className="text-[10px] text-[var(--ink-muted)]">{row.bestSupplyProtocol}</p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[var(--ink-muted)] italic">No pool yet</span>
                    )}
                  </td>

                  {/* Best Borrow APR & Oracle status */}
                  <td className="py-3 px-3">
                    {hasMarket ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="font-mono font-bold text-sm text-[var(--ink)]">
                            {row.bestBorrowApr !== null && row.bestBorrowApr > 0
                              ? `${row.bestBorrowApr.toFixed(2)}%`
                              : "—"}
                          </p>
                          {hasOracleWarning && (
                            <span title="Unknown Oracle — Borrowing Disabled">
                              <AlertTriangle size={13} className="text-amber-500" />
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--ink-muted)]">
                          {row.bestBorrowProtocol ?? (row.bestSupplyApy > 0 ? "Yield Vault" : "Collateral only")}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[var(--ink-muted)]">—</span>
                    )}
                  </td>

                  {/* Liquidity */}
                  <td className="py-3 px-3 font-mono text-[var(--ink)]">
                    {hasMarket && row.totalLiquidityUsd > 0 ? formatCompactUsd(row.totalLiquidityUsd) : "—"}
                  </td>

                  {/* Protocol Chips ("Listed on: Morpho, Beefy, ...") */}
                  <td className="py-3 px-3">
                    {hasMarket && row.listedProtocols && row.listedProtocols.length > 0 && row.listedProtocols[0] !== "No Pool" ? (
                      <div className="flex items-center gap-1 flex-wrap max-w-[150px]">
                        {row.listedProtocols.map((p) => (
                          <span
                            key={p}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border-subtle)]"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-[var(--ink-dim)]">Unlisted</span>
                    )}
                  </td>

                  {/* Balance */}
                  <td className="py-3 px-3">
                    {!isConnected ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestConnect?.();
                        }}
                        className="text-[11px] font-bold text-[var(--brand-text)] hover:underline cursor-pointer"
                      >
                        Connect
                      </button>
                    ) : row.walletBalance !== undefined && row.walletBalance !== null ? (
                      <div>
                        <p className="font-mono font-bold text-[var(--ink)]">
                          {row.walletBalance > 0 ? row.walletBalance.toFixed(3) : "0"}
                        </p>
                        {row.walletBalanceUsd !== undefined && row.walletBalanceUsd !== null && row.walletBalanceUsd > 0 && (
                          <p className="text-[10px] text-[var(--ink-muted)] font-mono">
                            ${row.walletBalanceUsd.toFixed(2)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--ink-dim)]">—</span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="py-3 px-3 text-right">
                    {hasMarket ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAsset(row.symbol);
                        }}
                        className="pop-pill px-3 py-1.5 rounded-xl bg-[#0052FF] text-white font-bold text-xs shadow-xs group-hover:bg-[#0047e0] transition flex items-center gap-1 ml-auto cursor-pointer"
                      >
                        <span>Compare</span>
                        <ChevronRight size={13} />
                      </button>
                    ) : (
                      <span className="text-[11px] text-[var(--ink-dim)] italic pr-2">No pool</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile Card List */}
        <div className="grid grid-cols-1 gap-2.5 md:hidden">
          {filteredRows.map((row) => (
            <div
              key={row.symbol}
              onClick={() => onSelectAsset(row.symbol)}
              className="pop p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] space-y-2.5 transition cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <TokenLogo
                    address={row.address}
                    symbol={row.symbol}
                    size={36}
                    shape="rounded-xl"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-sm text-[var(--ink)]">{row.symbol}</span>
                      {row.isNew && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--border-subtle)]">
                          <Sparkles size={8} /> NEW
                        </span>
                      )}
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-[var(--surface)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
                        {row.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-muted)]">{row.name}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-mono font-bold text-sm text-[var(--ink)]">${row.priceUsd.toFixed(2)}</p>
                  <span className="text-[10px] text-[var(--ink-muted)]">{formatCompactUsd(row.totalLiquidityUsd)} liq</span>
                </div>
              </div>

              {/* Protocol chips */}
              {row.listedProtocols && row.listedProtocols.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap text-[10px]">
                  <span className="text-[var(--ink-muted)]">Listed:</span>
                  {row.listedProtocols.map((p) => (
                    <span key={p} className="px-1.5 py-0.2 rounded bg-[var(--surface)] text-[var(--ink)] font-bold">
                      {p}
                    </span>
                  ))}
                </div>
              )}

              {/* APY / APR Row */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)]/60 text-xs">
                <div className="p-2 rounded-lg bg-[var(--surface)]">
                  <span className="text-[10px] text-[var(--ink-muted)]">Supply APY</span>
                  <p className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {row.bestSupplyApy > 0 ? `${row.bestSupplyApy.toFixed(2)}%` : "—"}
                  </p>
                  <span className="text-[9px] text-[var(--ink-dim)]">{row.bestSupplyProtocol}</span>
                </div>

                <div className="p-2 rounded-lg bg-[var(--surface)]">
                  <span className="text-[10px] text-[var(--ink-muted)]">Borrow APR</span>
                  <p className="font-mono font-bold text-[var(--ink)]">
                    {row.bestBorrowApr !== null && row.bestBorrowApr > 0 ? `${row.bestBorrowApr.toFixed(2)}%` : "—"}
                  </p>
                  <span className="text-[9px] text-[var(--ink-dim)]">{row.bestBorrowProtocol ?? "Collateral only"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
