"use client";

import React, { useState, useMemo } from "react";
import { Search, X, Coins, ShieldCheck, ChevronDown, ChevronUp, AlertCircle, ArrowUpRight, ExternalLink } from "lucide-react";
import type { LendingMarket } from "@/lib/lending/types";

export interface GaugeRowData {
  id: string;
  pairName: string; // e.g. NVDAc / USDC
  stockSymbol: string;
  category: string;
  gaugeApr: number; // e.g. 38.45
  tvlUsd: number;
  rewardToken: string; // AERO
  stakedAmount: number;
  stakedUsd: number;
  pendingRewards: number;
  pendingRewardsUsd: number;
  contractAddress: `0x${string}`;
}

interface GaugesTableProps {
  gauges: GaugeRowData[];
  isConnected: boolean;
  onRequestConnect?: () => void;
  onOpenStake?: (gauge: GaugeRowData) => void;
  onOpenUnstake?: (gauge: GaugeRowData) => void;
  onClaim?: (gauge: GaugeRowData) => void;
}

export default function GaugesTable({
  gauges,
  isConnected,
  onRequestConnect,
  onOpenStake,
  onOpenUnstake,
  onClaim,
}: GaugesTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const categories = ["all", "tech", "crypto", "finance", "consumer", "health", "aerospace"];

  const filteredGauges = useMemo(() => {
    let result = [...gauges];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (g) =>
          g.pairName.toLowerCase().includes(q) ||
          g.stockSymbol.toLowerCase().includes(q) ||
          g.category.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== "all") {
      result = result.filter((g) => g.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    return result;
  }, [gauges, searchQuery, selectedCategory]);

  const formatCompactUsd = (val: number): string => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header & Filter Row */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-[var(--ink)]">Aerodrome Stock LP Gauges</h2>
            <p className="text-xs text-[var(--ink-muted)]">
              Stake concentrated liquidity LP tokens on Base to earn boosted AERO rewards &amp; swap fees.
            </p>
          </div>

          <div className="relative max-w-xs w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Filter pair..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--ink)] focus:outline-none focus:border-[#0052FF]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
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
              {cat === "all" ? "All Gauges" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Gauges Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[11px] font-black uppercase tracking-wider text-[var(--ink-muted)]">
              <th className="py-3 px-3">Trading Pair</th>
              <th className="py-3 px-3 text-emerald-600 dark:text-emerald-400">Gauge APR</th>
              <th className="py-3 px-3">TVL</th>
              <th className="py-3 px-3">Reward Token</th>
              <th className="py-3 px-3">Your Staked</th>
              <th className="py-3 px-3">Pending Rewards</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]/60 text-xs">
            {filteredGauges.map((gauge) => (
              <tr key={gauge.id} className="pop-row transition">
                <td className="py-3 px-3">
                  <div>
                    <span className="font-mono font-bold text-sm text-[var(--ink)]">{gauge.pairName}</span>
                    <span className="text-[10px] text-[var(--ink-muted)] block">Aerodrome Slipstream</span>
                  </div>
                </td>
                <td className="py-3 px-3 font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                  {gauge.gaugeApr > 0 ? `${gauge.gaugeApr.toFixed(2)}%` : "—"}
                </td>
                <td className="py-3 px-3 font-mono text-[var(--ink)]">
                  {formatCompactUsd(gauge.tvlUsd)}
                </td>
                <td className="py-3 px-3">
                  <span className="font-mono font-bold px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border-subtle)] text-[11px]">
                    {gauge.rewardToken}
                  </span>
                </td>
                <td className="py-3 px-3 font-mono text-[var(--ink)]">
                  {gauge.stakedAmount > 0 ? `${gauge.stakedAmount.toFixed(4)} LP` : "—"}
                </td>
                <td className="py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400">
                  {gauge.pendingRewards > 0 ? `${gauge.pendingRewards.toFixed(2)} AERO` : "0.00"}
                </td>
                <td className="py-3 px-3 text-right">
                  {!isConnected ? (
                    <button
                      type="button"
                      onClick={onRequestConnect}
                      className="text-xs font-bold text-[var(--brand-text)] hover:underline cursor-pointer"
                    >
                      Connect
                    </button>
                  ) : (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenStake?.(gauge)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--brand)] text-white text-[11px] font-bold shadow-xs hover:opacity-90 transition cursor-pointer"
                      >
                        Stake
                      </button>
                      {gauge.stakedAmount > 0 && (
                        <button
                          type="button"
                          onClick={() => onOpenUnstake?.(gauge)}
                          className="pop-pill px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
                        >
                          Unstake
                        </button>
                      )}
                      {gauge.pendingRewards > 0 && (
                        <button
                          type="button"
                          onClick={() => onClaim?.(gauge)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-[11px] font-bold hover:bg-emerald-500/25 transition cursor-pointer"
                        >
                          Claim
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Collapsible "How Gauges Work" section */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowHowItWorks((prev) => !prev)}
          className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface)] transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Coins size={15} className="text-[var(--brand-text)]" />
            <span>How Aerodrome Stock Gauges &amp; Yield Work</span>
          </div>
          <span className="text-[var(--ink-muted)]">
            {showHowItWorks ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        {showHowItWorks && (
          <div className="p-4 pt-0 border-t border-[var(--border-subtle)]/60 text-xs text-[var(--ink-muted)] space-y-2">
            <p className="leading-relaxed">
              When you provide liquidity to an equity pool (e.g. NVDAc / USDC) on Aerodrome Slipstream, you receive LP tokens representing your pool share. Staking your LP tokens into the verified onchain gauge earns protocol emissions in AERO plus accrued swap trading fees.
            </p>
            <div className="p-3 rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <AlertCircle size={13} /> Impermanent Loss Note
              </span>
              <p className="text-[11px] leading-relaxed opacity-95">
                Providing liquidity across volatile equities and stablecoins carries impermanent loss risk if tokenized stock prices fluctuate sharply relative to USDC. Gauge yield can help offset this divergence over time.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
