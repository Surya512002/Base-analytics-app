"use client";

import React from "react";
import {
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  User,
  LayoutGrid,
  Table as TableIcon,
  Flame,
  Rocket,
  ShieldCheck,
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
  // Token types are chips: pick one to narrow the list, pick it again to see all.
  const typeChips: { id: ExploreCatalogTab; label: string; count: number }[] = [
    { id: "b20", label: "B20 tokens", count: counts.b20 },
    { id: "ecosystem", label: "Base ecosystem", count: counts.ecosystem },
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
          {!filters.onlyWatching && (
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
              className="rounded border-[var(--border-subtle)] text-[var(--brand-text)] accent-[var(--brand)] focus:ring-0 cursor-pointer"
            />
            <span>Hide &lt; $10K liq</span>
          </label>
          )}

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

      {/* 3. Smart Filter Preset Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[11px] uppercase font-bold tracking-wider text-[var(--ink-muted)] shrink-0 mr-0.5">
          Quick Filters:
        </span>

        {typeChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            aria-pressed={filters.catalogTab === chip.id}
            onClick={() => onChangeFilters((prev) => ({ ...prev, catalogTab: prev.catalogTab === chip.id ? "all" : chip.id }))}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border shrink-0 cursor-pointer ${
              filters.catalogTab === chip.id
                ? "bg-[var(--brand-soft)] border-[var(--brand)]/30 text-[var(--brand-text)] shadow-xs"
                : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <span>{chip.label}</span>
            <span className="font-mono text-[11px] opacity-70">{chip.count}</span>
          </button>
        ))}

        {/* Verified Only */}
        <button
          type="button"
          onClick={() =>
            onChangeFilters((prev) => ({
              ...prev,
              onlyVerified: !prev.onlyVerified,
            }))
          }
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border shrink-0 cursor-pointer ${
            filters.onlyVerified
              ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-xs"
              : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          <ShieldCheck size={12} className={filters.onlyVerified ? "text-blue-500" : ""} />
          <span>Verified Contracts</span>
        </button>

        {/* Volume > $100K */}
        <button
          type="button"
          onClick={() =>
            onChangeFilters((prev) => ({
              ...prev,
              minVolume100k: !prev.minVolume100k,
            }))
          }
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border shrink-0 cursor-pointer ${
            filters.minVolume100k
              ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-xs"
              : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          <Flame size={12} className={filters.minVolume100k ? "text-amber-500" : ""} />
          <span>High Volume (&gt; $100k)</span>
        </button>

        {/* Breakout > +15% */}
        <button
          type="button"
          onClick={() =>
            onChangeFilters((prev) => ({
              ...prev,
              breakoutOnly: !prev.breakoutOnly,
            }))
          }
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border shrink-0 cursor-pointer ${
            filters.breakoutOnly
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-xs"
              : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          <Rocket size={12} className={filters.breakoutOnly ? "text-emerald-500" : ""} />
          <span>Breakout (&gt; +15%)</span>
        </button>

        {/* Clear smart filters if any are active */}
        {(filters.onlyVerified || filters.minVolume100k || filters.breakoutOnly) && (
          <button
            type="button"
            onClick={() =>
              onChangeFilters((prev) => ({
                ...prev,
                onlyVerified: false,
                minVolume100k: false,
                breakoutOnly: false,
              }))
            }
            className="text-[11px] font-bold text-[var(--brand-text)] hover:underline ml-1 shrink-0 cursor-pointer"
          >
            Reset Smart Filters
          </button>
        )}
      </div>
    </div>
  );
}
