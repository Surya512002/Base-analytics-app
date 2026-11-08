"use client";

import React, { useMemo } from "react";
import { Sparkles, ArrowRight, ShieldCheck, Flame } from "lucide-react";
import { formatUsd } from "@/lib/launchpad/format";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";
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
  isLiveVerified?: boolean;
}

interface TopYieldSpotlightProps {
  markets?: NormalizedMarket[];
  gaugeRows?: GaugeRowData[];
  stockRows?: AssetMarketRow[];
  onSelectOption?: (protocol: string) => void;
  onExploreVault?: (target: YieldOptionTarget) => void;
  className?: string;
}

// Verified onchain Base baseline values (accurate fallbacks when live indexer is loading)
const BASELINE_YIELD_MARKETS: YieldOptionTarget[] = [
  {
    protocol: "aerodrome",
    protocolName: "Aerodrome Slipstream",
    asset: "NVDAc-USDC Gauge",
    stockSymbol: "NVDAc",
    contractAddress: "0xA282064541Bb45Caa046fB9f21a240671aBB7f46",
    marketId: "aero-nvdac-usdc",
    apy: 17.64,
    apr: 17.64,
    tvlUsd: 517538,
    isAutoCompounding: false,
    riskTier: "low",
    typeLabel: "DEX Gauge",
  },
  {
    protocol: "beefy",
    protocolName: "Beefy Auto-Vault",
    asset: "NVDAc-USDC Vault",
    stockSymbol: "NVDAc",
    contractAddress: "0xD317fDf7e7E3BA9dc9A73CAe2E54732646866025",
    marketId: "stock-lend-nvda",
    apy: 5.91,
    apr: null,
    tvlUsd: 207441,
    isAutoCompounding: true,
    riskTier: "low",
    typeLabel: "Auto-Compounder",
  },
  {
    protocol: "morpho_blue",
    protocolName: "Morpho Blue",
    asset: "USDC Collateral",
    marketId: "morpho-blue-weth-usdc",
    apy: 4.85,
    apr: null,
    tvlUsd: 14800000,
    isAutoCompounding: true,
    riskTier: "low",
    typeLabel: "Money Market",
  },
  {
    protocol: "moonwell",
    protocolName: "Moonwell Base",
    asset: "mUSDC Prime Market",
    contractAddress: "0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22",
    marketId: "moonwell-musdc",
    apy: 4.65,
    apr: null,
    tvlUsd: 28500000,
    isAutoCompounding: true,
    riskTier: "low",
    typeLabel: "Money Market",
  },
];

export default function TopYieldSpotlight({
  markets = [],
  gaugeRows = [],
  stockRows: _stockRows = [],
  onSelectOption,
  onExploreVault,
  className = "",
}: TopYieldSpotlightProps) {
  // Derive real live markets dynamically from verified on-chain data and pick the highest yield
  const bestOption: YieldOptionTarget = useMemo(() => {
    const list: YieldOptionTarget[] = [];
    const seen = new Set<string>();

    // 1. Match from gaugeRows (single pass, deduplicated by protocol and asset/contract)
    for (const g of gaugeRows) {
      if (g.gaugeApr > 0) {
        const isBeefy = g.rewardToken === "BEEFY" || g.pairName.toLowerCase().includes("beefy");
        const protocol = isBeefy ? "beefy" : g.rewardToken === "PENDLE" ? "pendle" : "aerodrome";
        const key = `${protocol}:${(g.contractAddress || g.id || g.pairName).toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            protocol,
            protocolName: isBeefy ? "Beefy Auto-Vault" : g.rewardToken === "PENDLE" ? "Pendle Finance" : "Aerodrome Slipstream",
            asset: g.pairName || `${g.stockSymbol || "Equities"} LP`,
            stockSymbol: g.stockSymbol,
            contractAddress: g.contractAddress,
            marketId: g.id,
            apy: Math.round(g.gaugeApr * 100) / 100,
            apr: Math.round(g.gaugeApr * 100) / 100,
            tvlUsd: g.tvlUsd,
            isAutoCompounding: isBeefy,
            riskTier: "low",
            typeLabel: isBeefy ? "Auto-Compounder" : g.rewardToken === "PENDLE" ? "Yield Token" : "DEX Gauge",
            isLiveVerified: true,
          });
        }
      }
    }

    // 2. Match from markets (protocol AND asset, avoiding duplicates)
    for (const m of markets) {
      if (m.status === "active" && ((m.supplyApy ?? 0) > 0 || (m.stakingApr ?? 0) > 0)) {
        const addrOrId = (m.contractAddress as string) || m.marketId || m.supplyAsset?.symbol || "";
        const key = `${m.protocol.toLowerCase()}:${addrOrId.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          const rate = m.supplyApy > 0 ? m.supplyApy : (m.stakingApr ?? 0);
          const isAuto = m.protocol === "beefy" || m.protocol === "morpho" || m.protocol === "moonwell";
          const assetName = m.supplyAsset?.name || m.supplyAsset?.symbol || "Asset";
          list.push({
            protocol: m.protocol,
            protocolName: m.protocolLabel || m.protocol,
            asset: assetName,
            stockSymbol: m.collateralAsset?.symbol || (m.supplyAsset?.isStock ? m.supplyAsset.symbol : undefined),
            contractAddress: (m.contractAddress as string) || undefined,
            marketId: m.marketId,
            apy: Math.round(rate * 100) / 100,
            apr: m.stakingApr ? Math.round(m.stakingApr * 100) / 100 : null,
            tvlUsd: m.tvlUsd || m.liquidityUsd || 0,
            isAutoCompounding: isAuto,
            riskTier: "low",
            typeLabel: isAuto ? "Auto-Compounder" : "Money Market",
            isLiveVerified: true,
          });
        }
      }
    }

    if (list.length > 0) {
      // Sort by APY / APR descending
      list.sort((a, b) => (b.apy ?? b.apr ?? 0) - (a.apy ?? a.apr ?? 0));
      return list[0]!;
    }

    // Baseline fallback clearly marked as not verified live
    return {
      ...BASELINE_YIELD_MARKETS[0]!,
      isLiveVerified: false,
    };
  }, [markets, gaugeRows]);

  const handleTriggerAction = (target: YieldOptionTarget) => {
    if (onExploreVault) {
      onExploreVault(target);
    } else if (onSelectOption) {
      onSelectOption(target.protocol);
    }
  };

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
            {bestOption.isLiveVerified ? (
              <>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-[var(--brand-text)] border border-blue-500/20">
                  Highest Verified Return on Base
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ink-muted)]">
                  <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Verified On-Chain</span>
                </span>
              </>
            ) : (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
                Loading Live Opportunities…
              </span>
            )}
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
