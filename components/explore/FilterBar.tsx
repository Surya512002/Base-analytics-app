"use client";

import React from "react";
import {
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  Coins,
  Star,
  User,
  LayoutGrid,
  Table as TableIcon,
  Filter,
} from "lucide-react";
import type {
  ExploreCatalogTab,
  TokenSortOption,
  ExploreFiltersState,
} from "@/lib/explore/explore-types";

interface FilterBarProps {
  filters: ExploreFiltersState;
  onChangeFilters: (updater: (prev: ExploreFiltersState) => ExploreFiltersState) => void;
  counts: {
    all: number;
    stocks: number;
    b20: number;
    ecosystem: number;
  };
  isConnected: boolean;
}

export default function FilterBar({
  filters,
  onChangeFilters,
  counts,
  isConnected,
}: FilterBarProps) {
  const catalogTabs: { id: ExploreCatalogTab; label: string; count: number }[] = [
    { id: "all", label: "All Tokens", count: counts.all },
    { id: "stocks", label: "Tokenized Stocks", count: counts.stocks },
    { id: "b20", label: "B20 Standards", count: counts.b20 },
    { id: "ecosystem", label: "Base Ecosystem", count: counts.ecosystem },
  ];

  const sortChips: { id: TokenSortOption; label: string; icon?: React.ReactNode }[] = [
    { id: "trending", label: "Trending", icon: <TrendingUp size={13} /> },
    { id: "newest", label: "New", icon: <Sparkles size={13} /> },
    { id: "gainers", label: "Top Gainers", icon: <ArrowUpRight size={13} className="text-emerald-500" /> },
    { id: "losers", label: "Losers", icon: <ArrowDownRight size={13} className="text-red-500" /> },
    { id: "volume", label: "Volume" },
    { id: "mcap", label: "Market Cap" },
  ];

  return (
    <div className="space-y-3.5">
      {/* 1. ONE Tab Row for Token Type (No nested duplicate tabs, no '////' glyph) */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] overflow-x-auto no-scrollbar w-fit py-1.5">
        {catalogTabs.map((tab) => {
          const isActive = filters.catalogTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                onChangeFilters((prev) => ({
                  ...prev,
                  catalogTab: tab.id,
                }))
              }
              className={`pop-pill px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
                isActive
                  ? "bg-[var(--brand)] text-white shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[var(--surface)] text-[var(--ink-dim)] border border-[var(--border-subtle)]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Filter Bar: Sort Chips, Toggles, and Table/Grid Switch */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs">
        {/* Sort Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2 -my-1 px-1 -mx-0.5">
          {sortChips.map((chip) => {
            const isSelected = filters.sort === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() =>
                  onChangeFilters((prev) => ({
                    ...prev,
                    sort: chip.id,
                  }))
                }
                className={`pop-pill px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-[var(--surface-2)] border border-[var(--brand)]/30 text-[var(--ink)] shadow-xs"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] border border-transparent"
                }`}
              >
                {chip.icon}
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Toggles + View Mode Switcher */}
        <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
          {/* Watching Toggle */}
          <button
            type="button"
            onClick={() =>
              onChangeFilters((prev) => ({
                ...prev,
                onlyWatching: !prev.onlyWatching,
              }))
            }
            className={`pop-pill px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
              filters.onlyWatching
                ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
            title="Filter watching tokens"
          >
            <Star
              size={13}
              className={filters.onlyWatching ? "fill-amber-500 text-amber-500" : ""}
            />
            <span>Watching</span>
          </button>

          {/* Mine Toggle (when connected) */}
          {isConnected && (
            <button
              type="button"
              onClick={() =>
                onChangeFilters((prev) => ({
                  ...prev,
                  onlyMine: !prev.onlyMine,
                }))
              }
              className={`pop-pill px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                filters.onlyMine
                  ? "bg-[var(--brand-soft)] border-[var(--brand)]/30 text-[var(--brand-text)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
              title="Filter tokens created by you"
            >
              <User size={13} />
              <span>Mine</span>
            </button>
          )}

          {/* Hide Low Liquidity Toggle */}
          <label className="pop-pill flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs font-medium text-[var(--ink-muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.hideLowLiquidity}
              onChange={(e) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  hideLowLiquidity: e.target.checked,
                }))
              }
              className="rounded border-[var(--border-subtle)] text-[var(--brand)] accent-[var(--brand)] focus:ring-0 cursor-pointer"
            />
            <span>Hide &lt; $10K liq</span>
          </label>

          {/* Table | Grid View Toggle */}
          <div className="flex items-center p-0.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]">
            <button
              type="button"
              onClick={() =>
                onChangeFilters((prev) => ({
                  ...prev,
                  viewMode: "table",
                }))
              }
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                filters.viewMode === "table"
                  ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
              title="Table view"
              aria-label="Table view"
            >
              <TableIcon size={14} />
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeFilters((prev) => ({
                  ...prev,
                  viewMode: "grid",
                }))
              }
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                filters.viewMode === "grid"
                  ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
