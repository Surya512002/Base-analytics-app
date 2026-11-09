"use client";

import React, { useMemo } from "react";
import { Sparkles, ArrowRight, ShieldCheck, Flame } from "lucide-react";
import { formatUsd } from "@/lib/launchpad/format";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";
import { MIN_TVL_USD } from "@/lib/lending/constants";
import type { GaugeRowData } from "./GaugesTable";
import type { AssetMarketRow } from "./MarketsTable";

export interface YieldOptionTarget {
  protocol: string;
  protocolName: string;
  asset: string;
  stockSymbol?: string;
  contractAddress?: string;
  marketId?: string;
  apy: number;
  apr?: number | null;
  tvlUsd?: number;
  isAutoCompounding: boolean;
  riskTier: "low" | "medium" | "degen";
  typeLabel?: string;
}

interface TopYieldSpotlightProps {
  markets?: NormalizedMarket[];
  gaugeRows?: GaugeRowData[];
  stockRows?: AssetMarketRow[];
  onSelectOption?: (protocol: string) => void;
  onExploreVault?: (target: YieldOptionTarget) => void;
  className?: string;
}

export default function TopYieldSpotlight({
  markets = [],
  gaugeRows = [],
  stockRows: _stockRows = [],
  onSelectOption,
  onExploreVault,
  className = "",
}: TopYieldSpotlightProps) {
  // Derive real live markets dynamically from verified on-chain data and pick the highest yield
  const bestOption: YieldOptionTarget | null = useMemo(() => {
    const list: YieldOptionTarget[] = [];

    // 1. Evaluate verified discovered markets above MIN_TVL_USD
    for (const m of markets) {
      const tvl = m.tvlUsd || m.liquidityUsd || 0;
      if (tvl < MIN_TVL_USD) continue;
      const rate = m.supplyApy > 0 ? m.supplyApy : (m.stakingApr ?? 0);
      if (rate <= 0) continue;

      const isCompounding = m.protocol === "beefy";
      list.push({
        protocol: m.protocol,
        protocolName: m.protocolLabel,
        asset: m.supplyAsset.symbol ? `${m.supplyAsset.symbol}` : m.protocolLabel,
        stockSymbol: m.supplyAsset.isStock
          ? m.supplyAsset.symbol
          : m.collateralAsset?.isStock
            ? m.collateralAsset.symbol
            : undefined,
        contractAddress: m.contractAddress,
        marketId: m.marketId,
        apy: Math.round(rate * 100) / 100,
        apr: m.stakingApr ? Math.round(m.stakingApr * 100) / 100 : null,
        tvlUsd: tvl,
        isAutoCompounding: isCompounding,
        riskTier: "low",
        typeLabel: isCompounding
          ? "Auto-Compounder"
          : m.type === "stake"
            ? "DEX Gauge"
            : "Money Market",
      });
    }

    // 2. Evaluate gauge rows above MIN_TVL_USD
    for (const g of gaugeRows) {
      const tvl = g.tvlUsd || 0;
      if (tvl < MIN_TVL_USD) continue;
      if (g.gaugeApr <= 0) continue;

      const isBeefy = g.rewardToken?.toUpperCase() === "BEEFY";
      const isPendle = g.rewardToken?.toUpperCase() === "PENDLE";
      const proto = isBeefy ? "beefy" : isPendle ? "pendle" : "aerodrome";
      const protoLabel = isBeefy
        ? "Beefy Finance"
        : isPendle
          ? "Pendle Finance"
          : "Aerodrome Finance";

      list.push({
        protocol: proto,
        protocolName: protoLabel,
        asset: g.pairName || "LP Gauge",
        stockSymbol: g.stockSymbol,
        contractAddress: g.contractAddress,
        marketId: g.id,
        apy: Math.round(g.gaugeApr * 100) / 100,
        apr: Math.round(g.gaugeApr * 100) / 100,
        tvlUsd: tvl,
        isAutoCompounding: isBeefy,
        riskTier: "low",
        typeLabel: isBeefy ? "Auto-Compounder" : isPendle ? "Yield Token" : "DEX Gauge",
      });
    }

    if (list.length === 0) return null;

    // Sort by APY / APR descending
    list.sort((a, b) => (b.apy ?? b.apr ?? 0) - (a.apy ?? a.apr ?? 0));
    return list[0];
  }, [markets, gaugeRows]);

  const handleTriggerAction = (target: YieldOptionTarget) => {
    if (onExploreVault) {
      onExploreVault(target);
    } else if (onSelectOption) {
      onSelectOption(target.protocol);
    }
  };

  if (!bestOption) {
    return (
      <div
        className={`rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5 shadow-card ${className}`}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--brand)] animate-pulse" />
          <span className="text-sm font-bold text-[var(--ink-muted)]">
            Scanning verified on-chain yield opportunities on Base mainnet...
          </span>
        </div>
      </div>
    );
  }

  const isGauge = !bestOption.isAutoCompounding;
  const rateLabel = isGauge ? "Gauge APR" : "Net APY";

  return (
    <div
      className={`rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-[var(--surface)] to-[var(--surface-2)] p-4 sm:p-5 shadow-card transition-all ${className}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Badge, Title & Plain Explanation */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
              <Sparkles size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Top Yield Spotlight</span>
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--border-subtle)]">
              Highest Verified Return on Base
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ink-muted)]">
              <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Verified On-Chain</span>
            </span>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-black text-[var(--ink)] tracking-tight flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span>{bestOption.protocolName}</span>
              <span className="text-[var(--ink-muted)] font-normal text-xs sm:text-sm">
                ({bestOption.asset})
              </span>
            </h3>
            <p className="text-xs text-[var(--ink-muted)] leading-relaxed mt-0.5">
              {bestOption.isAutoCompounding
                ? "Auto-compounding yield vault with automated reward harvesting and continuous reinvestment."
                : "Active fee rewards & onchain staking emissions on Base mainnet with no lockup period."}
            </p>
          </div>
        </div>

        {/* Right: Key Rate, TVL & Direct Action */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--border-subtle)]">
          {/* Rate Metric */}
          <div className="px-3.5 py-2 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-left sm:text-right">
            <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-[var(--ink-muted)] sm:justify-end">
              <Flame size={12} className="text-amber-500 shrink-0" />
              <span>{rateLabel}</span>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {bestOption.apy > 0 ? `${bestOption.apy.toFixed(2)}%` : "Unavailable"}
            </div>
          </div>

          {/* TVL Metric (Tablet/Desktop) */}
          {bestOption.tvlUsd && (
            <div className="hidden sm:block px-3.5 py-2 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--ink-muted)] block">
                Pool TVL
              </span>
              <span className="text-sm font-bold font-mono text-[var(--ink)] tabular-nums">
                {formatUsd(bestOption.tvlUsd)}
              </span>
            </div>
          )}

          {/* Explore Action Button */}
          <button
            type="button"
            onClick={() => handleTriggerAction(bestOption)}
            className="btn-primary min-h-[44px] px-4 sm:px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-[0.98] cursor-pointer shrink-0"
            title={`Open and deposit into ${bestOption.protocolName}`}
          >
            <span>Explore Vault</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
