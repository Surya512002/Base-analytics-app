"use client";

import React, { useState, useMemo } from "react";
import { Search, X, SlidersHorizontal, ArrowUpDown, ChevronRight, CheckCircle2, TrendingUp, Lock, RefreshCw, Wallet, Clock } from "lucide-react";
import type { BaseStock } from "@/lib/stocks/base-stocks";
import { BASE_STOCKS } from "@/lib/stocks/base-stocks";
import { isUSMarketOpenNow } from "@/lib/launchpad/launch-configs";

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
}

interface MarketsTableProps {
  rows: AssetMarketRow[];
  selectedSymbol?: string | null;
  onSelectAsset: (symbol: string) => void;
  isConnected: boolean;
  onRequestConnect?: () => void;
  mode?: "lend" | "borrow" | "stake";
  loading?: boolean;
}

export default function MarketsTable({
  rows,
  selectedSymbol,
  onSelectAsset,
  isConnected,
  onRequestConnect,
  mode = "lend",
  loading = false,
}: MarketsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [onlyHoldings, setOnlyHoldings] = useState(false);
  const [sortBy, setSortBy] = useState<"supply" | "borrow" | "liquidity" | "price" | "name">("supply");
  const [sortAsc, setSortAsc] = useState(false);

  const isMarketOpen = isUSMarketOpenNow();

  // Categories list
  const categories = ["all", "tech", "crypto", "finance", "consumer", "health", "aerospace"];

  // Filter & Sort
  const filteredRows = useMemo(() => {
    let result = [...rows];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.symbol.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
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
  }, [rows, searchQuery, selectedCategory, onlyHoldings, sortBy, sortAsc]);

  const toggleSort = (field: "supply" | "borrow" | "liquidity" | "price" | "name") => {
    if (sortBy === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortBy(field);
      setSortAsc(field === "borrow" || field === "name"); // Default ascending for borrow and name
    }
  };

  const formatCompactUsd = (val: number): string => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] overflow-hidden shadow-xs space-y-4 p-4 sm:p-5">
      {/* Toolbar: Search, Categories, Sort, and Holdings Toggle */}
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
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--ink)] placeholder-[var(--ink-dim)] focus:outline-none focus:border-[#0052FF]"
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

          {/* Holdings Toggle & Sort Select */}
          <div className="flex items-center gap-3 self-end sm:self-auto">
            {isConnected && (
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={onlyHoldings}
                  onChange={(e) => setOnlyHoldings(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[#0052FF] accent-[#0052FF]"
                />
                <span className="font-medium">My Holdings only</span>
              </label>
            )}

            <div className="text-xs text-[var(--ink-muted)] font-mono">
              {filteredRows.length} {filteredRows.length === 1 ? "asset" : "assets"}
            </div>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2 -my-1 px-1 -mx-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`pop-pill px-3 py-1 rounded-lg text-xs font-bold capitalize transition whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#0052FF] text-white shadow-xs"
                  : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--border-subtle)]"
              }`}
            >
              {cat === "all" ? "All Categories" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table View (Desktop) & Cards (Mobile) */}
      <div className="w-full overflow-x-auto">
        {/* Desktop Table */}
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
              <th className="py-3 px-3">Your Balance</th>
              <th className="py-3 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]/60 text-xs">
            {filteredRows.map((row) => {
              const isSelected = selectedSymbol?.toLowerCase() === row.symbol.toLowerCase();

              return (
                <tr
                  key={row.symbol}
                  onClick={() => onSelectAsset(row.symbol)}
                  className={`pop-row group transition cursor-pointer ${
                    isSelected ? "bg-[#0052FF]/5 font-medium" : ""
                  }`}
                >
                  {/* Asset */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center font-mono font-black text-xs text-[var(--ink)] shrink-0 group-hover:border-[#0052FF] transition">
                        {row.symbol.slice(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-sm text-[var(--ink)]">{row.symbol}</span>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
                            {row.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--ink-muted)] truncate max-w-[140px]">{row.name}</p>
                      </div>
                    </div>
                  </td>

                  {/* Price + Chainlink dot */}
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
                  <td className="py-3 px-3">
                    <div>
                      <p className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {row.bestSupplyApy > 0 ? `${row.bestSupplyApy.toFixed(2)}%` : "—"}
                      </p>
                      <p className="text-[10px] text-[var(--ink-muted)]">{row.bestSupplyProtocol}</p>
                    </div>
                  </td>

                  {/* Best Borrow APR */}
                  <td className="py-3 px-3">
                    <div>
                      <p className="font-mono font-bold text-sm text-[var(--ink)]">
                        {row.bestBorrowApr !== null && row.bestBorrowApr > 0
                          ? `${row.bestBorrowApr.toFixed(2)}%`
                          : "—"}
                      </p>
                      <p className="text-[10px] text-[var(--ink-muted)]">
                        {row.bestBorrowProtocol ?? "Collateral only"}
                      </p>
                    </div>
                  </td>

                  {/* Liquidity */}
                  <td className="py-3 px-3 font-mono text-[var(--ink)]">
                    {formatCompactUsd(row.totalLiquidityUsd)}
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
                        className="text-[11px] font-bold text-[#0052FF] hover:underline cursor-pointer"
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
                  <div className="w-9 h-9 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center font-mono font-black text-xs text-[var(--ink)]">
                    {row.symbol.slice(0, 3)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-sm text-[var(--ink)]">{row.symbol}</span>
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
