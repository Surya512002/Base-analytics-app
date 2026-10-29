"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  X,
  Coins,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowUpRight,
  ExternalLink,
  Sparkles,
  Layers,
} from "lucide-react";

export interface GaugeRowData {
  id: string;
  pairName: string; // e.g. NVDAc / USDC
  stockSymbol: string;
  category: string;
  gaugeApr: number; // e.g. 38.45
  tvlUsd: number;
  rewardToken: string; // BEEFY, AERO, PENDLE
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
  const [protocolFilter, setProtocolFilter] = useState<"all" | "beefy" | "aerodrome">("all");
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const categories = ["all", "tech", "crypto", "finance", "consumer", "healthcare"];

  const filteredGauges = useMemo(() => {
    let result = [...gauges];

    // Filter by protocol
    if (protocolFilter === "beefy") {
      result = result.filter((g) => g.rewardToken === "BEEFY" || g.id.includes("beefy") || g.pairName.includes("Beefy"));
    } else if (protocolFilter === "aerodrome") {
      result = result.filter((g) => g.rewardToken !== "BEEFY" && !g.id.includes("beefy") && !g.pairName.includes("Beefy"));
    }

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
  }, [gauges, protocolFilter, searchQuery, selectedCategory]);

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
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold mb-1">
              <Sparkles size={12} />
              <span>Beefy Finance &amp; Aerodrome Gauges</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-[var(--ink)]">
              Tokenized Stock Staking &amp; Auto-Compounding Vaults
            </h2>
            <p className="text-xs text-[var(--ink-muted)]">
              Auto-compound LP yield via <strong>Beefy Finance</strong> or stake directly in <strong>Aerodrome Slipstream gauges</strong> on Base.
            </p>
          </div>

          <div className="relative max-w-xs w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Filter by stock (e.g. NVDA, MSFT)..."
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

        {/* Protocol Selector & Categories */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-[var(--border-subtle)]">
          {/* Protocol Toggle */}
          <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-xl border border-[var(--border-subtle)] w-fit">
            <button
              type="button"
              onClick={() => setProtocolFilter("all")}
              className={`pop-pill px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                protocolFilter === "all"
                  ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              All Protocols
            </button>
            <button
              type="button"
              onClick={() => setProtocolFilter("beefy")}
              className={`pop-pill px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                protocolFilter === "beefy"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              <span>Beefy Vaults</span>
              <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-mono">Auto</span>
            </button>
            <button
              type="button"
              onClick={() => setProtocolFilter("aerodrome")}
              className={`pop-pill px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                protocolFilter === "aerodrome"
                  ? "bg-[#0052FF] text-white shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              <span>Aerodrome Gauges</span>
              <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-mono">AERO</span>
            </button>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`pop-pill px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#0052FF] text-white shadow-xs"
                    : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--border-subtle)]"
                }`}
              >
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gauges & Vaults Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[11px] font-black uppercase tracking-wider text-[var(--ink-muted)]">
              <th className="py-3 px-3">Protocol &amp; Pair</th>
              <th className="py-3 px-3 text-emerald-600 dark:text-emerald-400">APY / APR</th>
              <th className="py-3 px-3">TVL</th>
              <th className="py-3 px-3">Reward Mechanism</th>
              <th className="py-3 px-3">Your Staked</th>
              <th className="py-3 px-3">Rewards</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]/60 text-xs">
            {filteredGauges.map((gauge) => {
              const isBeefy = gauge.rewardToken === "BEEFY" || gauge.id.includes("beefy") || gauge.pairName.includes("Beefy");
              const isPendle = gauge.rewardToken === "PENDLE" || gauge.id.includes("pendle");

              return (
                <tr key={gauge.id} className="pop-row transition">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isBeefy ? "bg-purple-500" : isPendle ? "bg-cyan-500" : "bg-[#0052FF]"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-sm text-[var(--ink)]">
                            {gauge.pairName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                              isBeefy
                                ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                                : isPendle
                                  ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20"
                                  : "bg-[#0052FF]/10 text-[#0052FF] dark:text-[#3B82F6] border border-[#0052FF]/20"
                            }`}
                          >
                            {isBeefy ? "Beefy Finance" : isPendle ? "Pendle Finance" : "Aerodrome Gauge"}
                          </span>
                          <a
                            href={
                              isBeefy
                                ? `https://app.beefy.com/vault/${gauge.id.replace(/^beefy-/, "")}`
                                : "https://aerodrome.finance/pools"
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[var(--ink-dim)] hover:text-[var(--brand-text)] flex items-center gap-0.5"
                          >
                            <span>App</span>
                            <ExternalLink size={9} />
                          </a>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3 font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                    {gauge.gaugeApr > 0 ? `${gauge.gaugeApr.toFixed(2)}%` : "—"}
                  </td>

                  <td className="py-3 px-3 font-mono text-[var(--ink)]">
                    {formatCompactUsd(gauge.tvlUsd)}
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] border ${
                        isBeefy
                          ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                          : "bg-[var(--surface-2)] text-[var(--ink)] border-[var(--border-subtle)]"
                      }`}
                    >
                      {isBeefy ? "Auto-Compounded LP" : gauge.rewardToken}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono text-[var(--ink)]">
                    {gauge.stakedAmount > 0 ? `${gauge.stakedAmount.toFixed(4)} LP` : "—"}
                  </td>

                  <td className="py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400">
                    {isBeefy
                      ? "Auto-Reinvested"
                      : gauge.pendingRewards > 0
                        ? `${gauge.pendingRewards.toFixed(2)} AERO`
                        : "0.00"}
                  </td>

                  <td className="py-3 px-3 text-right">
                    {!isConnected ? (
                      <button
                        type="button"
                        onClick={onRequestConnect}
                        className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] text-xs font-bold border border-[var(--border-subtle)] cursor-pointer"
                      >
                        Connect
                      </button>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenStake?.(gauge)}
                          className="px-3 py-1.5 rounded-lg bg-[#0052FF] hover:bg-[#0045D8] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          {isBeefy ? "Deposit" : "Stake"}
                        </button>
                        {gauge.stakedAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => onOpenUnstake?.(gauge)}
                            className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] text-xs font-bold border border-[var(--border-subtle)] cursor-pointer"
                          >
                            Unstake
                          </button>
                        )}
                        {!isBeefy && gauge.pendingRewards > 0 && (
                          <button
                            type="button"
                            onClick={() => onClaim?.(gauge)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                          >
                            Claim
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* How Staking & Auto-Compounding Works Collapsible */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={() => setShowHowItWorks((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs font-bold text-[var(--brand-text)] hover:underline cursor-pointer"
        >
          <span>How Beefy Auto-Compounders &amp; Aerodrome Gauges work on Base</span>
          {showHowItWorks ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {showHowItWorks && (
          <div className="mt-3 p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--ink-muted)] space-y-2 leading-relaxed">
            <p>
              <strong>1. Beefy Finance Auto-Compounding Vaults:</strong> When you deposit tokenized stock LP shares (e.g., MSFTc-USDC) into Beefy, Beefy&apos;s smart contracts automatically harvest the trading fees and $AERO gauge emissions from Aerodrome, convert them into more stock-USDC LP tokens, and reinvest them into the vault. This compounds your yield 24/7 without manual gas costs or transaction signing.
            </p>
            <p>
              <strong>2. Aerodrome Slipstream Gauges:</strong> Aerodrome allows you to stake your concentrated liquidity LP tokens directly in their gauges. In return, you receive weekly $AERO emission rewards that you can claim at any time.
            </p>
            <p>
              <strong>3. Risk Transparency:</strong> Neither Beefy vaults nor Aerodrome LP gauges involve borrow debt or liquidation risk. The only risk is standard AMM impermanent loss if the equity price shifts relative to USDC.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
