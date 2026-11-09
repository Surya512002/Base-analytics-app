"use client";

import React, { useState, useMemo } from "react";
import {
  Compass,
  Search,
  Filter,
  ShieldCheck,
  AlertTriangle,
  Flame,
  ArrowRight,
  TrendingUp,
  Percent,
  Sparkles,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  X,
  Layers,
} from "lucide-react";
import { FEATURES } from "@/lib/constants/features";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";
import type { GaugeRowData } from "./GaugesTable";
import type { AssetMarketRow } from "./MarketsTable";
import {
  determineYieldRiskTier,
  filterAndSortYieldPools,
  formatRate,
  type UnifiedYieldPool,
  type AssetCategory,
  type RiskTier,
} from "@/lib/lending/yield-finder-math";
import { formatUsd } from "@/lib/launchpad/format";

interface YieldFinderProps {
  markets: NormalizedMarket[];
  gaugeRows: GaugeRowData[];
  stockRows?: AssetMarketRow[];
  onSelectPool?: (pool: UnifiedYieldPool) => void;
  onRequestConnect?: () => void;
  isConnected?: boolean;
  className?: string;
}

const DEFAULT_VISIBLE_COUNT = 8;

export default function YieldFinder({
  markets,
  gaugeRows,
  stockRows: _stockRows,
  onSelectPool,
  onRequestConnect: _onRequestConnect,
  isConnected: _isConnected = false,
  className = "",
}: YieldFinderProps) {
  const [assetCategory, setAssetCategory] = useState<AssetCategory>("all");
  const [riskTier, setRiskTier] = useState<RiskTier | "all">("all");
  const [minTvlUsd, setMinTvlUsd] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"apy_desc" | "apr_desc" | "tvl_desc" | "risk_asc" | "protocol">("apy_desc");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"compact" | "cards">("compact");
  const [showAll, setShowAll] = useState<boolean>(false);

  // 1. Normalize all markets and gauges into UnifiedYieldPool[] with complete APY & APR metrics
  const unifiedPools = useMemo(() => {
    const list: UnifiedYieldPool[] = [];
    const seenIds = new Set<string>();

    // Process all discovered & baseline lending / yield markets
    for (const m of markets) {
      if (seenIds.has(m.marketId)) continue;
      seenIds.add(m.marketId);

      const isStock = Boolean(
        m.supplyAsset?.isStock ||
        m.collateralAsset?.isStock ||
        m.supplyAsset?.symbol?.endsWith("c") ||
        m.collateralAsset?.symbol?.endsWith("c")
      );

      const protocolName = m.protocol?.toLowerCase() || "morpho";

      const { riskTier: tier, riskReason } = determineYieldRiskTier({
        protocol: protocolName,
        isStock,
        assetSymbol: m.supplyAsset?.symbol || "TOKEN",
      });

      // Match gauge from gaugeRows if present for live reward updates
      const matchingGauge = gaugeRows.find((g) => g.id === m.marketId);

      // Primary APY (compounded or lending supply yield)
      const supplyApy = typeof m.supplyApy === "number" && m.supplyApy > 0 ? m.supplyApy : null;

      // Staking / Gauge APR
      const rawApr =
        matchingGauge && matchingGauge.gaugeApr > 0
          ? matchingGauge.gaugeApr
          : typeof m.stakingApr === "number" && m.stakingApr > 0
            ? m.stakingApr
            : null;

      // Borrow APR (for money markets like Morpho, Aave, Moonwell)
      const borrowApr = typeof m.borrowApr === "number" && m.borrowApr > 0 ? m.borrowApr : null;

      // Resolve primary APY
      const apy = supplyApy ?? (rawApr ?? null);

      // Resolve primary APR (gauge APR or borrow APR)
      const apr = rawApr ?? (protocolName === "aerodrome" ? (supplyApy ?? null) : null);

      const isBeefy = protocolName === "beefy";
      const isAero = protocolName === "aerodrome";
      const isBorrow = m.type === "borrow";

      list.push({
        id: m.marketId,
        name: m.supplyAsset?.name || `${m.protocolLabel} ${m.supplyAsset?.symbol || "Market"}`,
        assetSymbol: m.supplyAsset?.symbol || "TOKEN",
        protocol: (protocolName as UnifiedYieldPool["protocol"]) || "morpho",
        protocolLabel: m.protocolLabel || "Base Lending",
        apy,
        apr,
        borrowApr,
        tvlUsd: m.tvlUsd && m.tvlUsd > 0 ? m.tvlUsd : (m.liquidityUsd && m.liquidityUsd > 0 ? m.liquidityUsd : null),
        liquidityUsd: m.liquidityUsd && m.liquidityUsd > 0 ? m.liquidityUsd : null,
        maxLtv: m.maxLtv && m.maxLtv > 0 ? m.maxLtv : null,
        utilization: m.utilization && m.utilization > 0 ? m.utilization : null,
        riskTier: tier,
        riskReason,
        contractAddress: m.contractAddress || "",
        actionType: isBeefy ? "vault" : isAero ? "stake" : isBorrow ? "borrow" : "supply",
        isStock,
        badgeText: m.badgeText,
      });
    }

    // Capture any standalone gauges in gaugeRows not present in markets
    for (const g of gaugeRows) {
      if (seenIds.has(g.id)) continue;
      seenIds.add(g.id);

      const isBeefy = g.id.startsWith("beefy-");
      const cleanPair = g.pairName.replace(/usdc/gi, "");
      const isStock = Boolean(
        g.stockSymbol?.endsWith("c") ||
        cleanPair.includes("c-") ||
        cleanPair.includes("c/") ||
        cleanPair.includes("c /") ||
        cleanPair.trim().endsWith("c")
      );
      const { riskTier: tier, riskReason } = determineYieldRiskTier({
        protocol: isBeefy ? "beefy" : "aerodrome",
        isStock,
        assetSymbol: g.pairName,
      });

      const rate = g.gaugeApr > 0 ? g.gaugeApr : null;

      list.push({
        id: g.id,
        name: isBeefy ? `Beefy Auto-Vault (${g.pairName})` : `Aerodrome ${g.pairName} Gauge`,
        assetSymbol: g.pairName,
        protocol: isBeefy ? "beefy" : "aerodrome",
        protocolLabel: isBeefy ? "Beefy Finance" : "Aerodrome Finance",
        apy: rate,
        apr: rate,
        borrowApr: null,
        tvlUsd: g.tvlUsd > 0 ? g.tvlUsd : null,
        liquidityUsd: g.tvlUsd > 0 ? g.tvlUsd : null,
        maxLtv: null,
        utilization: null,
        riskTier: tier,
        riskReason,
        contractAddress: g.contractAddress,
        actionType: isBeefy ? "vault" : "stake",
        isStock,
        rewardToken: g.rewardToken,
      });
    }

    return list;
  }, [markets, gaugeRows]);

  // 2. High-Level Macro KPI Stats Strip
  const kpiStats = useMemo(() => {
    let topApy = 0;
    let topApr = 0;
    let sumApy = 0;
    let countApy = 0;
    let totalTvl = 0;

    for (const p of unifiedPools) {
      if (p.apy && p.apy > 0) {
        if (p.apy > topApy) topApy = p.apy;
        sumApy += p.apy;
        countApy++;
      }
      if (p.apr && p.apr > 0) {
        if (p.apr > topApr) topApr = p.apr;
      }
      if (p.tvlUsd && p.tvlUsd > 0) {
        totalTvl += p.tvlUsd;
      }
    }

    return {
      topApy: topApy > 0 ? topApy : null,
      topApr: topApr > 0 ? topApr : null,
      avgApy: countApy > 0 ? Number((sumApy / countApy).toFixed(1)) : null,
      totalTvlUsd: totalTvl,
      totalPools: unifiedPools.length,
    };
  }, [unifiedPools]);

  // 3. Filter & Sort
  const filteredPools = useMemo(() => {
    return filterAndSortYieldPools(unifiedPools, {
      assetCategory,
      riskTier,
      minTvlUsd,
      sortBy,
      searchQuery,
    });
  }, [unifiedPools, assetCategory, riskTier, minTvlUsd, sortBy, searchQuery]);

  // Constrain displayed items so users never have an endless scroll
  const displayedPools = useMemo(() => {
    if (showAll) return filteredPools;
    return filteredPools.slice(0, DEFAULT_VISIBLE_COUNT);
  }, [filteredPools, showAll]);

  const hasActiveFilters =
    assetCategory !== "all" ||
    riskTier !== "all" ||
    minTvlUsd > 0 ||
    searchQuery.trim().length > 0;

  const resetFilters = () => {
    setAssetCategory("all");
    setRiskTier("all");
    setMinTvlUsd(0);
    setSearchQuery("");
  };

  if (!FEATURES.YIELD_FINDER) {
    return null;
  }

  return (
    <div
      data-testid="yield-finder-container"
      className={`rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 space-y-5 shadow-card ${className}`}
    >
      {/* 1. Header with View Toggle & Result Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[var(--brand)]/10 text-[var(--brand-text)] flex items-center justify-center border border-[var(--brand)]/20 shadow-xs shrink-0">
            <Compass size={22} className="text-[var(--brand-text)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-[var(--ink)]">Yield Finder</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--brand)] text-white">
                Multi-Protocol Scanner
              </span>
            </div>
            <p className="text-xs text-[var(--ink-muted)]">
              Scan &amp; rank real Base yields across Aerodrome, Beefy, Morpho, Moonwell &amp; Aave
            </p>
          </div>
        </div>

        {/* View Mode Switcher & Count */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-mono font-bold text-[var(--ink-muted)] mr-1">
            {filteredPools.length} Pools Available
          </span>

          <div className="flex items-center p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setViewMode("compact")}
              aria-label="Compact Table View"
              title="Compact Table View"
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === "compact"
                  ? "bg-[var(--surface)] text-[var(--brand-text)] shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              aria-label="Cards View"
              title="Cards View"
              className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === "cards"
                  ? "bg-[var(--surface)] text-[var(--brand-text)] shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Micro KPI Stats Strip: Instant At-a-Glance Intelligence */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-[10px] font-bold text-[var(--ink-muted)]">
            <span>Top APY</span>
            <TrendingUp size={12} className="text-emerald-500" />
          </div>
          <div className="mt-1 text-sm sm:text-base font-mono font-black text-emerald-600 dark:text-emerald-400">
            {kpiStats.topApy !== null ? `${formatRate(kpiStats.topApy)} APY` : "Unavailable"}
          </div>
          <span className="text-[10px] text-[var(--ink-dim)]">Max compounded</span>
        </div>

        <div className="p-3 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-[10px] font-bold text-[var(--ink-muted)]">
            <span>Top APR</span>
            <Sparkles size={12} className="text-blue-500" />
          </div>
          <div className="mt-1 text-sm sm:text-base font-mono font-black text-blue-600 dark:text-blue-400">
            {kpiStats.topApr !== null ? `${formatRate(kpiStats.topApr)} APR` : "Unavailable"}
          </div>
          <span className="text-[10px] text-[var(--ink-dim)]">Gauge / Staking rewards</span>
        </div>

        <div className="p-3 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-[10px] font-bold text-[var(--ink-muted)]">
            <span>Avg Yield</span>
            <Percent size={12} className="text-[var(--ink-dim)]" />
          </div>
          <div className="mt-1 text-sm sm:text-base font-mono font-black text-[var(--ink)]">
            {kpiStats.avgApy !== null ? `${kpiStats.avgApy.toFixed(1)}%` : "Unavailable"}
          </div>
          <span className="text-[10px] text-[var(--ink-dim)]">Across active pools</span>
        </div>

        <div className="p-3 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-[10px] font-bold text-[var(--ink-muted)]">
            <span>Tracked TVL</span>
            <Layers size={12} className="text-[var(--ink-dim)]" />
          </div>
          <div className="mt-1 text-sm sm:text-base font-mono font-black text-[var(--ink)]">
            {kpiStats.totalTvlUsd > 0 ? formatUsd(kpiStats.totalTvlUsd) : "Unindexed"}
          </div>
          <span className="text-[10px] text-[var(--ink-dim)]">Total verified volume</span>
        </div>
      </div>

      {/* 3. Filter and Search Toolbar */}
      <div className="space-y-3 relative z-10">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-dim)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search pool, token (e.g. USDC, NVDAc), or protocol…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-xs text-[var(--ink)] outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-dim)] hover:text-[var(--ink)]"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="yield-sort-by" className="text-xs font-bold text-[var(--ink-muted)] shrink-0 hidden sm:inline cursor-pointer">
              Sort:
            </label>
            <select
              id="yield-sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--ink)] outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] cursor-pointer transition"
            >
              <option value="apy_desc" className="bg-[var(--surface)] text-[var(--ink)]">Highest APY</option>
              <option value="apr_desc" className="bg-[var(--surface)] text-[var(--ink)]">Highest APR / Rewards</option>
              <option value="tvl_desc" className="bg-[var(--surface)] text-[var(--ink)]">Largest TVL</option>
              <option value="risk_asc" className="bg-[var(--surface)] text-[var(--ink)]">Lowest Risk First</option>
              <option value="protocol" className="bg-[var(--surface)] text-[var(--ink)]">Protocol Name</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
          {/* Asset Category */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-[var(--ink-muted)] font-bold flex items-center gap-1">
              <Filter size={12} />
              Asset:
            </span>
            {(["all", "usdc", "eth", "stocks"] as const).map((cat) => {
              const active = assetCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAssetCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                    active
                      ? "bg-[var(--brand)] text-white shadow-xs border border-[var(--brand)]"
                      : "bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-3)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {cat === "all" ? "All Assets" : cat.toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* Risk Tier */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-[var(--ink-muted)] font-bold">Risk:</span>
            {(["all", "low", "moderate", "degen"] as const).map((tier) => {
              const active = riskTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRiskTier(tier)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                    active
                      ? "bg-[var(--brand)] text-white shadow-xs border border-[var(--brand)]"
                      : "bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-3)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {tier === "all" ? "All Tiers" : tier === "low" ? "Low Risk" : tier === "moderate" ? "Moderate" : "Degen"}
                </button>
              );
            })}
          </div>

          {/* Min TVL */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-[var(--ink-muted)] font-bold">Min TVL:</span>
            {[0, 10_000, 50_000, 100_000].map((tvl) => {
              const active = minTvlUsd === tvl;
              return (
                <button
                  key={tvl}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMinTvlUsd(tvl)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                    active
                      ? "bg-[var(--brand)] text-white shadow-xs border border-[var(--brand)]"
                      : "bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-3)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {tvl === 0 ? "Any" : tvl >= 1_000_000 ? `$${tvl / 1_000_000}M+` : `$${tvl / 1000}k+`}
                </button>
              );
            })}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] font-bold text-[var(--brand-text)] hover:underline ml-1 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Yield Pools List (Compact Table vs Cards View) */}
      {filteredPools.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)]/30 text-center space-y-2 text-xs">
          <p className="font-bold text-[var(--ink)]">No yield pools matched your criteria</p>
          <p className="text-[var(--ink-muted)] max-w-sm mx-auto text-[11px]">
            Try relaxing your minimum TVL or selecting &quot;All Assets&quot; to inspect all Base opportunities.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-2 px-3 py-1.5 rounded-xl bg-[var(--brand)] text-white text-xs font-bold cursor-pointer hover:opacity-90"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === "compact" ? (
        /* COMPACT TABLE VIEW (Solves long-scroll problem) */
        <div className={`overflow-x-auto rounded-2xl border border-[var(--border-subtle)] ${showAll ? "max-h-[580px] overflow-y-auto" : ""}`}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border-subtle)] text-[11px] font-bold text-[var(--ink-muted)]">
                <th className="py-2.5 px-3.5">Strategy / Protocol</th>
                <th className="py-2.5 px-3.5">Net APY</th>
                <th className="py-2.5 px-3.5">APR / Rewards</th>
                <th className="py-2.5 px-3.5">Pool TVL</th>
                <th className="py-2.5 px-3.5 hidden md:table-cell">LTV / Util</th>
                <th className="py-2.5 px-3.5">Risk Tier</th>
                <th className="py-2.5 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {displayedPools.map((pool) => {
                const isLowRisk = pool.riskTier === "low";
                const isModerate = pool.riskTier === "moderate";

                return (
                  <tr
                    key={pool.id}
                    className="hover:bg-[var(--surface-2)]/60 transition-colors group"
                  >
                    {/* Strategy & Protocol */}
                    <td className="py-3 px-3.5">
                      <div className="flex flex-col">
                        <span className="font-bold text-[var(--ink)] text-xs group-hover:text-[var(--brand-text)] transition-colors">
                          {pool.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--ink-muted)] mt-0.5">
                          <span className="font-mono uppercase font-bold text-[var(--brand-text)]">
                            {pool.protocolLabel}
                          </span>
                          {pool.badgeText && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[140px]">{pool.badgeText}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Net APY */}
                    <td className="py-3 px-3.5">
                      <span className="font-mono font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <TrendingUp size={13} className="shrink-0" />
                        {pool.apy !== null ? `${formatRate(pool.apy)} APY` : "Unavailable"}
                      </span>
                    </td>

                    {/* APR / Rewards / Borrow */}
                    <td className="py-3 px-3.5">
                      {pool.apr !== null ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 font-mono font-bold text-[11px]">
                          <Sparkles size={11} className="text-blue-500 shrink-0" />
                          <span>{formatRate(pool.apr)} APR</span>
                        </span>
                      ) : pool.borrowApr !== null ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-mono font-bold text-[11px]">
                          <span>Borrow: {formatRate(pool.borrowApr)}</span>
                        </span>
                      ) : (
                        <span className="text-[var(--ink-dim)] text-[11px] font-mono">-</span>
                      )}
                    </td>

                    {/* TVL */}
                    <td className="py-3 px-3.5 font-mono font-bold text-[var(--ink)] text-xs">
                      {pool.tvlUsd !== null ? formatUsd(pool.tvlUsd) : "Unindexed"}
                    </td>

                    {/* LTV & Utilization */}
                    <td className="py-3 px-3.5 hidden md:table-cell text-[11px] font-mono text-[var(--ink-muted)]">
                      {pool.maxLtv !== null ? (
                        <span>
                          {pool.maxLtv}% LTV
                          {pool.utilization !== null ? ` · ${pool.utilization}% Util` : ""}
                        </span>
                      ) : (
                        <span className="text-[var(--ink-dim)]">N/A</span>
                      )}
                    </td>

                    {/* Risk Tier */}
                    <td className="py-3 px-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          isLowRisk
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : isModerate
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                              : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                        }`}
                        title={pool.riskReason}
                      >
                        {isLowRisk ? (
                          <ShieldCheck size={11} />
                        ) : isModerate ? (
                          <AlertTriangle size={11} />
                        ) : (
                          <Flame size={11} />
                        )}
                        <span>{pool.riskTier === "low" ? "Low Risk" : pool.riskTier === "moderate" ? "Moderate" : "Degen"}</span>
                      </span>
                    </td>

                    {/* Action Button */}
                    <td className="py-3 px-3.5 text-right">
                      {onSelectPool && (
                        <button
                          type="button"
                          onClick={() => onSelectPool(pool)}
                          className="pop-pill inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold bg-[var(--brand)] text-white hover:opacity-90 transition text-xs shadow-xs cursor-pointer shrink-0"
                        >
                          <span>{pool.actionType === "vault" ? "Deposit" : pool.actionType === "stake" ? "Stake" : pool.actionType === "borrow" ? "Borrow" : "Supply"}</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${showAll ? "max-h-[580px] overflow-y-auto pr-1" : ""}`}>
          {displayedPools.map((pool) => {
            const isLowRisk = pool.riskTier === "low";
            const isModerate = pool.riskTier === "moderate";

            return (
              <div
                key={pool.id}
                className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 hover:bg-[var(--surface-2)] hover:border-[var(--brand)]/30 transition-all hover:shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--brand-text)] font-bold block">
                        {pool.protocolLabel}
                      </span>
                      <h4 className="text-sm font-bold text-[var(--ink)] leading-snug">{pool.name}</h4>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 shrink-0 ${
                        isLowRisk
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : isModerate
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                            : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {isLowRisk ? (
                        <ShieldCheck size={11} />
                      ) : isModerate ? (
                        <AlertTriangle size={11} />
                      ) : (
                        <Flame size={11} />
                      )}
                      <span>{pool.riskTier === "low" ? "Low Risk" : pool.riskTier === "moderate" ? "Moderate" : "Degen"}</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-[var(--ink-muted)] mt-1 line-clamp-1">{pool.riskReason}</p>
                </div>

                {/* 4-Box Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
                  <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--ink-dim)] block">Net APY</span>
                    <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                      <TrendingUp size={13} />
                      {pool.apy !== null ? `${formatRate(pool.apy)} APY` : "Unavailable"}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--ink-dim)] block">
                      {pool.apr !== null ? "Gauge / Staking APR" : pool.borrowApr !== null ? "Borrow APR" : "Reward APR"}
                    </span>
                    <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 block mt-0.5">
                      {pool.apr !== null
                        ? `${formatRate(pool.apr)} APR`
                        : pool.borrowApr !== null
                          ? `${formatRate(pool.borrowApr)} Borrow`
                          : "0.0% APR"}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--ink-dim)] block">Pool TVL</span>
                    <span className="text-xs font-mono font-bold text-[var(--ink)] block mt-0.5">
                      {pool.tvlUsd !== null ? formatUsd(pool.tvlUsd) : "Unindexed"}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--ink-dim)] block">LTV / Capital Rate</span>
                    <span className="text-xs font-mono font-bold text-[var(--ink)] block mt-0.5">
                      {pool.maxLtv !== null ? `${pool.maxLtv}% Max LTV` : "DEX Staking"}
                    </span>
                  </div>
                </div>

                {onSelectPool && (
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onSelectPool(pool)}
                      className="pop-pill w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-bold bg-[var(--brand)] text-white hover:opacity-90 transition text-xs shadow-xs cursor-pointer"
                    >
                      <span>{pool.actionType === "vault" ? "Deposit" : pool.actionType === "stake" ? "Stake" : pool.actionType === "borrow" ? "Borrow" : "Supply"}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Pagination / Show More Control (Eliminates Endless Page Scrolling) */}
      {filteredPools.length > DEFAULT_VISIBLE_COUNT && (
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--border-subtle)] text-xs text-[var(--ink-muted)]">
          <span>
            Showing <strong className="text-[var(--ink)]">{displayedPools.length}</strong> of{" "}
            <strong className="text-[var(--ink)]">{filteredPools.length}</strong> verified yield opportunities
          </span>

          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="pop-pill inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border-subtle)] text-[var(--brand-text)] font-bold transition cursor-pointer self-start sm:self-auto"
          >
            <span>{showAll ? "Show Top 8 Opportunities" : `View All ${filteredPools.length} Opportunities`}</span>
            {showAll ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      )}
    </div>
  );
}
