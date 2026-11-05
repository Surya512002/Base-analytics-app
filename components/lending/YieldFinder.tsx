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
} from "lucide-react";
import { FEATURES } from "@/lib/constants/features";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";
import type { GaugeRowData } from "./GaugesTable";
import type { AssetMarketRow } from "./MarketsTable";
import {
  determineYieldRiskTier,
  filterAndSortYieldPools,
  type UnifiedYieldPool,
  type AssetCategory,
  type RiskTier,
} from "@/lib/lending/yield-finder-math";
import { formatUsd } from "@/lib/launchpad/format";

interface YieldFinderProps {
  markets: NormalizedMarket[];
  gaugeRows: GaugeRowData[];
  stockRows: AssetMarketRow[];
  onSelectPool?: (pool: UnifiedYieldPool) => void;
  onRequestConnect?: () => void;
  isConnected?: boolean;
  className?: string;
}

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
  const [sortBy, setSortBy] = useState<"apy_desc" | "tvl_desc" | "risk_asc" | "protocol">("apy_desc");
  const [searchQuery, setSearchQuery] = useState<string>("");


  // 1. Normalize all markets and gauges into UnifiedYieldPool[]
  const unifiedPools = useMemo(() => {
    const list: UnifiedYieldPool[] = [];
    const seenIds = new Set<string>();

    // Add Aerodrome gauges
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

      list.push({
        id: g.id,
        name: isBeefy ? `Beefy Auto-Vault (${g.pairName})` : `Aerodrome ${g.pairName} Gauge`,
        assetSymbol: g.pairName,
        protocol: isBeefy ? "beefy" : "aerodrome",
        protocolLabel: isBeefy ? "Beefy Finance" : "Aerodrome Finance",
        apy: g.gaugeApr > 0 ? g.gaugeApr : null,
        tvlUsd: g.tvlUsd > 0 ? g.tvlUsd : null,
        riskTier: tier,
        riskReason,
        contractAddress: g.contractAddress,
        actionType: isBeefy ? "vault" : "stake",
        isStock,
      });
    }

    // Add Lending Markets (Morpho, Moonwell, Aave)
    for (const m of markets) {
      if (seenIds.has(m.marketId)) continue;
      seenIds.add(m.marketId);

      const apy = m.supplyApy ?? 0;
      const isStock = !!m.supplyAsset?.isStock || m.supplyAsset?.symbol?.endsWith("c") || false;
      const protocolName = m.protocol?.toLowerCase() || "morpho";

      const { riskTier: tier, riskReason } = determineYieldRiskTier({
        protocol: protocolName,
        isStock,
        assetSymbol: m.supplyAsset?.symbol || "TOKEN",
      });

      list.push({
        id: m.marketId,
        name: `${m.protocolLabel} ${m.supplyAsset?.symbol || "Market"}`,
        assetSymbol: m.supplyAsset?.symbol || "TOKEN",
        protocol: (protocolName as UnifiedYieldPool["protocol"]) || "morpho",
        protocolLabel: m.protocolLabel || "Base Lending",
        apy: apy > 0 ? apy : null,
        tvlUsd: m.tvlUsd && m.tvlUsd > 0 ? m.tvlUsd : null,
        riskTier: tier,
        riskReason,
        contractAddress: m.contractAddress || "",
        actionType: "supply",
        isStock,
      });
    }

    return list;
  }, [markets, gaugeRows]);

  // 2. Filter & Sort
  const filteredPools = useMemo(() => {
    return filterAndSortYieldPools(unifiedPools, {
      assetCategory,
      riskTier,
      minTvlUsd,
      sortBy,
      searchQuery,
    });
  }, [unifiedPools, assetCategory, riskTier, minTvlUsd, sortBy, searchQuery]);

  if (!FEATURES.YIELD_FINDER) {
    return null;
  }

  return (
    <div
      data-testid="yield-finder-container"
      className={`rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 space-y-5 shadow-card ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center border border-[#0052FF]/20 shadow-xs shrink-0">
            <Compass size={22} className="text-[#0052FF]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-[var(--ink)]">Yield Finder</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0052FF] text-white">
                Multi-Protocol Scanner
              </span>
            </div>
            <p className="text-xs text-[var(--ink-muted)]">
              Discover and rank real Base yield strategies across Aerodrome, Beefy, Morpho &amp; Moonwell
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold text-[var(--ink-muted)]">
          {filteredPools.length} Pools Available
        </span>
      </div>

      {/* Filter and Search Bar */}
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
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-xs text-[var(--ink)] outline-none focus:border-[#0052FF] focus:ring-1 focus:ring-[#0052FF] transition"
            />
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
              className="px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--ink)] outline-none focus:border-[#0052FF] focus:ring-1 focus:ring-[#0052FF] cursor-pointer transition"
            >
              <option value="apy_desc" className="bg-[var(--surface)] text-[var(--ink)]">Highest APY</option>
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
                      ? "bg-[#0052FF] text-white shadow-xs border border-[#0052FF]"
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
                      ? "bg-[#0052FF] text-white shadow-xs border border-[#0052FF]"
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
                      ? "bg-[#0052FF] text-white shadow-xs border border-[#0052FF]"
                      : "bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-3)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {tvl === 0 ? "Any" : tvl >= 1_000_000 ? `$${tvl / 1_000_000}M+` : `$${tvl / 1000}k+`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Yield Pools List */}
      {filteredPools.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)]/30 text-center space-y-2 text-xs">
          <p className="font-bold text-[var(--ink)]">No yield pools matched your criteria</p>
          <p className="text-[var(--ink-muted)] max-w-sm mx-auto text-[11px]">
            Try relaxing your minimum TVL or selecting &quot;All Assets&quot; to inspect all Base opportunities.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredPools.map((pool) => {
            const isLowRisk = pool.riskTier === "low";
            const isModerate = pool.riskTier === "moderate";

            return (
              <div
                key={pool.id}
                className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 hover:bg-[var(--surface-2)] hover:border-[#0052FF]/30 transition-all hover:shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-dim)] block">
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

                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-[var(--ink-dim)] block">Net APY</span>
                    <span className="text-base font-mono font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <TrendingUp size={14} />
                      {pool.apy !== null ? `${pool.apy.toFixed(1)}% APY` : "Unavailable"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-[var(--ink-dim)] block">Pool TVL</span>
                    <span className="text-xs font-mono font-bold text-[var(--ink)]">
                      {pool.tvlUsd !== null ? formatUsd(pool.tvlUsd) : "Unindexed"}
                    </span>
                  </div>

                  {onSelectPool && (
                    <button
                      type="button"
                      onClick={() => onSelectPool(pool)}
                      className="pop-pill inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold bg-[#0052FF] text-white hover:bg-[#0047e0] transition text-xs shadow-xs cursor-pointer"
                    >
                      <span>{pool.actionType === "vault" ? "Deposit" : pool.actionType === "stake" ? "Stake" : "Supply"}</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
