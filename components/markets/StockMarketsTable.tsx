"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Star,
  Info,
  ArrowRight,
} from "lucide-react";
import type { StockMarketItem } from "@/lib/markets/types";
import { computeTradeSafety } from "@/lib/markets/price-impact-service";

interface StockMarketsTableProps {
  stocks: StockMarketItem[];
  loading?: boolean;
  onSelectStock?: (stock: StockMarketItem) => void;
  watchlist?: string[];
  onToggleWatchlist?: (address: string) => void;
  className?: string;
}

type SortColumn = "price" | "change" | "liquidity" | "impact" | "collateral";

function formatUsdDisplay(val: number | null | undefined): string {
  if (val == null || isNaN(val) || val <= 0) return "—";
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function StockMarketsTable({
  stocks,
  loading = false,
  onSelectStock,
  watchlist = [],
  onToggleWatchlist,
  className = "",
}: StockMarketsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortCol, setSortCol] = useState<SortColumn>("liquidity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of stocks) {
      if (s.category) set.add(s.category.toLowerCase());
    }
    return ["all", ...Array.from(set)];
  }, [stocks]);

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      // For impact, lower is better so default to asc, for others default desc
      setSortDir(col === "impact" ? "asc" : "desc");
    }
  };

  const filteredStocks = useMemo(() => {
    let list = [...stocks];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.underlyingTicker.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.address.toLowerCase() === q
      );
    }

    if (selectedCategory !== "all") {
      list = list.filter((s) => s.category.toLowerCase() === selectedCategory);
    }

    list.sort((a, b) => {
      let valA: number = 0;
      let valB: number = 0;

      if (sortCol === "price") {
        valA = a.price;
        valB = b.price;
      } else if (sortCol === "change") {
        valA = a.change24h;
        valB = b.change24h;
      } else if (sortCol === "liquidity") {
        valA = a.tradingLiquidity;
        valB = b.tradingLiquidity;
      } else if (sortCol === "impact") {
        valA = a.priceImpact10k ?? 999;
        valB = b.priceImpact10k ?? 999;
      } else if (sortCol === "collateral") {
        valA = a.usedAsCollateral ?? 0;
        valB = b.usedAsCollateral ?? 0;
      }

      return sortDir === "asc" ? valA - valB : valB - valA;
    });

    return list;
  }, [stocks, searchQuery, selectedCategory, sortCol, sortDir]);

  return (
    <div
      data-testid="stock-markets-table"
      className={`rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 space-y-4 shadow-xs ${className}`}
    >
      {/* Table Header: Search & Category Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-[var(--border-subtle)]">
        <div>
          <h3 className="text-lg font-black text-[var(--ink)] tracking-tight">
            All Tokenized Stocks
          </h3>
          <p className="text-xs text-[var(--ink-muted)]">
            24/7 liquid U.S. equities on Base backed 1:1 in regulated custody
          </p>
        </div>

        {/* Search Bar & Category Chips */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker, name, or 0x..."
              className="w-full sm:w-64 pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink)] placeholder-[var(--ink-muted)] focus:outline-none focus:border-[var(--brand)] transition"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {categories.slice(0, 5).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs capitalize px-2.5 py-1.5 rounded-xl transition font-medium whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-[var(--brand)] text-white shadow-xs"
                    : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DESKTOP VIEW: Sortable Responsive Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[11px] font-bold text-[var(--ink-muted)] uppercase tracking-wider">
              <th className="py-3 px-3 w-8"></th>
              <th className="py-3 px-3">Stock</th>
              <th
                onClick={() => handleSort("price")}
                className="py-3 px-3 text-right cursor-pointer hover:text-[var(--ink)] transition select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Token Price</span>
                  {sortCol === "price" ? (
                    sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  ) : (
                    <ArrowUpDown size={11} className="opacity-40" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort("liquidity")}
                className="py-3 px-3 text-right cursor-pointer hover:text-[var(--ink)] transition select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Trading Liquidity</span>
                  <div
                    className="cursor-help"
                    title="Estimated pool depth available in primary DEX paired pools (USDC)."
                  >
                    <Info size={11} className="text-[var(--ink-muted)]" />
                  </div>
                  {sortCol === "liquidity" ? (
                    sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  ) : (
                    <ArrowUpDown size={11} className="opacity-40" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort("impact")}
                className="py-3 px-3 text-right cursor-pointer hover:text-[var(--ink)] transition select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Impact on $10K</span>
                  <div
                    className="cursor-help"
                    title="Realized percentage price impact for a $10,000 USD trade."
                  >
                    <Info size={11} className="text-[var(--ink-muted)]" />
                  </div>
                  {sortCol === "impact" ? (
                    sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  ) : (
                    <ArrowUpDown size={11} className="opacity-40" />
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort("collateral")}
                className="py-3 px-3 text-right cursor-pointer hover:text-[var(--ink)] transition select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Used as Collateral</span>
                  <div
                    className="cursor-help"
                    title="Total USD value supplied as collateral in lending markets."
                  >
                    <Info size={11} className="text-[var(--ink-muted)]" />
                  </div>
                  {sortCol === "collateral" ? (
                    sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  ) : (
                    <ArrowUpDown size={11} className="opacity-40" />
                  )}
                </div>
              </th>
              <th className="py-3 px-3 text-right w-24">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
            {filteredStocks.map((stock) => {
              const safety = computeTradeSafety(stock.priceImpact10k);
              const isWatched = watchlist.includes(stock.address.toLowerCase());

              return (
                <tr
                  key={stock.address}
                  onClick={() => onSelectStock?.(stock)}
                  className="group hover:bg-[var(--surface-2)]/60 cursor-pointer transition"
                >
                  {/* Watchlist Star */}
                  <td
                    className="py-3.5 px-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWatchlist?.(stock.address);
                    }}
                  >
                    <button
                      type="button"
                      className="p-1 rounded-md text-[var(--ink-muted)] hover:text-amber-500 transition"
                      aria-label="Toggle watchlist"
                    >
                      <Star
                        size={14}
                        className={isWatched ? "fill-amber-400 text-amber-500" : ""}
                      />
                    </button>
                  </td>

                  {/* Stock Info */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 overflow-hidden font-bold text-xs text-[var(--ink-muted)]">
                        {stock.underlyingTicker.slice(0, 2)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[var(--ink)]">{stock.symbol}</span>
                          <span className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">
                            {stock.underlyingTicker}
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--ink-muted)] truncate max-w-[180px]">
                          {stock.name}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Price + 24h Change */}
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-[var(--ink)] tabular-nums">
                        ${stock.price.toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] font-bold tabular-nums flex items-center gap-0.5 ${
                          stock.change24h >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {stock.change24h >= 0 ? "+" : ""}
                        {stock.change24h.toFixed(2)}%
                      </span>
                    </div>
                  </td>

                  {/* Trading Liquidity */}
                  <td className="py-3.5 px-3 text-right">
                    <span className="font-semibold text-[var(--ink)] tabular-nums">
                      {formatUsdDisplay(stock.tradingLiquidity)}
                    </span>
                  </td>

                  {/* Price Impact on $10K */}
                  <td className="py-3.5 px-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold border tabular-nums ${safety.badgeColorClass}`}
                    >
                      {safety.badgeLabel}
                    </span>
                  </td>

                  {/* Used as Collateral */}
                  <td className="py-3.5 px-3 text-right">
                    <span className="font-semibold text-[var(--ink)] tabular-nums">
                      {formatUsdDisplay(stock.usedAsCollateral)}
                    </span>
                  </td>

                  {/* Quick Action: Swap */}
                  <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/swap?buy=${stock.address}`}
                      className="inline-flex items-center gap-1 py-1 px-2.5 rounded-xl text-xs font-bold bg-[#0052FF] text-white hover:opacity-90 active:scale-95 transition"
                    >
                      <span>Swap</span>
                      <ArrowRight size={11} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MOBILE VIEW (< 768px): Cards Layout (Zero Horizontal Overflow) */}
      <div className="md:hidden space-y-3">
        {filteredStocks.map((stock) => {
          const safety = computeTradeSafety(stock.priceImpact10k);
          const isWatched = watchlist.includes(stock.address.toLowerCase());

          return (
            <div
              key={stock.address}
              onClick={() => onSelectStock?.(stock)}
              className="p-4 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] space-y-3 cursor-pointer active:scale-[0.98] transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center font-bold text-xs shrink-0 text-[var(--ink)]">
                    {stock.underlyingTicker.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-[var(--ink)]">{stock.symbol}</span>
                      <span className="text-[10px] text-[var(--ink-muted)]">
                        · {stock.underlyingTicker}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--ink-muted)] truncate max-w-[160px]">
                      {stock.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWatchlist?.(stock.address);
                    }}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--ink-muted)] hover:text-amber-500"
                    aria-label="Toggle watchlist"
                  >
                    <Star
                      size={16}
                      className={isWatched ? "fill-amber-400 text-amber-500" : ""}
                    />
                  </button>

                  <div className="text-right">
                    <div className="text-sm font-black text-[var(--ink)] tabular-nums">
                      ${stock.price.toFixed(2)}
                    </div>
                    <span
                      className={`text-[11px] font-bold tabular-nums ${
                        stock.change24h >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {stock.change24h >= 0 ? "+" : ""}
                      {stock.change24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile Stats Row */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)] text-[11px]">
                <div>
                  <span className="text-[10px] text-[var(--ink-muted)] block">Liquidity</span>
                  <span className="font-semibold text-[var(--ink)] tabular-nums">
                    {formatUsdDisplay(stock.tradingLiquidity)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--ink-muted)] block">Impact on $10K</span>
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold border tabular-nums ${safety.badgeColorClass}`}
                  >
                    {safety.badgeLabel}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--ink-muted)] block">Collateral</span>
                  <span className="font-semibold text-[var(--ink)] tabular-nums">
                    {formatUsdDisplay(stock.usedAsCollateral)}
                  </span>
                </div>
              </div>

              {/* Mobile Action Bar */}
              <div
                className="flex items-center justify-end pt-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  href={`/swap?buy=${stock.address}`}
                  className="min-h-[44px] px-4 rounded-xl text-xs font-bold bg-[#0052FF] text-white flex items-center gap-1.5 active:scale-95 transition"
                >
                  <span>Trade {stock.symbol}</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {filteredStocks.length === 0 && !loading && (
        <div className="py-12 text-center text-xs text-[var(--ink-muted)]">
          No tokenized stocks match &quot;{searchQuery}&quot;. Try another symbol or category.
        </div>
      )}

      {/* Official Base Markets Disclaimer */}
      <div className="pt-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--ink-muted)] leading-relaxed">
        <p>
          <strong className="text-[var(--ink)] font-semibold">Information only, not investment advice.</strong>{" "}
          Base Markets provides transparency on tokenized equities, pool depths, and on-chain collateral on Base.
          Reported liquidity does not guarantee that a trade can be completed at a particular price or size.
        </p>
      </div>
    </div>
  );
}
