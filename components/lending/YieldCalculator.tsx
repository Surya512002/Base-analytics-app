"use client";

import React, { useState, useMemo } from "react";
import {
  Calculator,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Coins,
  Percent,
} from "lucide-react";
import { formatUsd } from "@/lib/launchpad/format";

interface ProtocolYieldEstimate {
  protocol: string;
  protocolName: string;
  asset: string;
  apy: number;
  isAutoCompounding: boolean;
  riskTier: "low" | "medium" | "degen";
}

const DEFAULT_YIELD_MARKETS: ProtocolYieldEstimate[] = [
  {
    protocol: "beefy",
    protocolName: "Beefy Auto-Vault",
    asset: "NVDAc-USDC",
    apy: 12.8,
    isAutoCompounding: true,
    riskTier: "low",
  },
  {
    protocol: "aerodrome",
    protocolName: "Aerodrome Gauge",
    asset: "MSFTc-USDC",
    apy: 10.4,
    isAutoCompounding: false,
    riskTier: "medium",
  },
  {
    protocol: "morpho_blue",
    protocolName: "Morpho Blue",
    asset: "USDC Collateral",
    apy: 8.6,
    isAutoCompounding: true,
    riskTier: "low",
  },
  {
    protocol: "moonwell",
    protocolName: "Moonwell Base",
    asset: "cbETH / USDC",
    apy: 6.2,
    isAutoCompounding: true,
    riskTier: "low",
  },
];

const PRESET_AMOUNTS = [250, 1000, 5000, 10000, 25000];

export default function YieldCalculator({
  onSelectOption,
}: {
  onSelectOption?: (protocol: string) => void;
}) {
  const [amount, setAmount] = useState<number>(1000);
  const [horizon, setHorizon] = useState<"daily" | "monthly" | "1y" | "3y">("1y");

  // Calculate earnings for each protocol based on amount and horizon
  const calculations = useMemo(() => {
    const principal = Number.isFinite(amount) && amount > 0 ? amount : 0;

    return DEFAULT_YIELD_MARKETS.map((market) => {
      const rate = market.apy / 100;

      let returnAmount = 0;
      if (horizon === "daily") {
        returnAmount = (principal * rate) / 365;
      } else if (horizon === "monthly") {
        returnAmount = (principal * rate) / 12;
      } else if (horizon === "1y") {
        // Compound quarterly or simple
        returnAmount = principal * (Math.pow(1 + rate / 4, 4) - 1);
      } else if (horizon === "3y") {
        // 3-year compound
        returnAmount = principal * (Math.pow(1 + rate / 4, 12) - 1);
      }

      const totalValue = principal + returnAmount;
      return {
        ...market,
        returnAmount,
        totalValue,
      };
    }).sort((a, b) => b.returnAmount - a.returnAmount);
  }, [amount, horizon]);

  const bestOption = calculations[0];

  return (
    <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 shadow-card space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Calculator size={18} />
          </div>
          <div>
            <h3 className="text-base font-black text-[var(--ink)] tracking-tight flex items-center gap-1.5">
              <span>Interactive APY Yield Calculator</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Live Estimates
              </span>
            </h3>
            <p className="text-xs text-[var(--ink-muted)]">
              Simulate compound returns across verified Base lending &amp; vault protocols.
            </p>
          </div>
        </div>

        {/* Time Horizon Selector */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] self-start sm:self-center">
          {(
            [
              { id: "daily", label: "Daily" },
              { id: "monthly", label: "Monthly" },
              { id: "1y", label: "1 Year" },
              { id: "3y", label: "3 Years" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setHorizon(t.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                horizon === t.id
                  ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Amount Input & Quick Chips */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="yield-amount" className="font-bold text-[var(--ink-muted)] uppercase tracking-wider text-[10px]">
            Investment Principal (USD)
          </label>
          <span className="font-mono text-[var(--ink-dim)]">Base Mainnet Pool Rate</span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-sm text-[var(--ink-muted)]">
              $
            </span>
            <input
              id="yield-amount"
              type="number"
              min="1"
              max="1000000"
              value={amount || ""}
              onChange={(e) => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="1,000"
              className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-base font-mono font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--brand)]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmount(amt)}
                className={`pop-pill px-3 py-2 rounded-xl text-xs font-mono font-bold border transition cursor-pointer shrink-0 ${
                  amount === amt
                    ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                    : "bg-[var(--surface-2)] text-[var(--ink-muted)] border-[var(--border-subtle)] hover:text-[var(--ink)] hover:bg-[var(--surface-3)]"
                }`}
              >
                ${amt.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Banner Recommendation */}
      {bestOption && (
        <div className="p-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
              <Sparkles size={15} className="text-emerald-600 shrink-0" />
              <span>Highest Projected Yield: {bestOption.protocolName} ({bestOption.asset})</span>
            </div>
            <p className="text-[11px] text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
              Earn estimated <strong className="text-emerald-700 dark:text-emerald-300">+{formatUsd(bestOption.returnAmount)}</strong> ({bestOption.apy.toFixed(1)}% APY) with automatic compounding. Total portfolio value: <strong>{formatUsd(bestOption.totalValue)}</strong>.
            </p>
          </div>

          {onSelectOption && (
            <button
              type="button"
              onClick={() => onSelectOption(bestOption.protocol)}
              className="btn-primary px-3.5 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
            >
              <span>Explore Vault</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}

      {/* Protocols Comparison Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {calculations.map((calc, i) => (
          <div
            key={calc.protocol}
            className={`p-3.5 rounded-2xl border transition relative flex flex-col justify-between ${
              i === 0
                ? "bg-[var(--surface-2)] border-[var(--brand)]/40 shadow-xs"
                : "bg-[var(--surface-2)] border-[var(--border-subtle)]"
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1.5">
                <span className="font-bold text-xs text-[var(--ink)] truncate">
                  {calc.protocolName}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                  {calc.apy.toFixed(1)}% APY
                </span>
              </div>

              <span className="text-[10px] text-[var(--ink-muted)] block truncate font-mono">
                Asset: {calc.asset}
              </span>
            </div>

            <div className="pt-3 mt-2 border-t border-[var(--border-subtle)]/70 space-y-0.5">
              <span className="text-[10px] text-[var(--ink-muted)] block">
                Estimated Returns ({horizon})
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                  +{formatUsd(calc.returnAmount)}
                </span>
                <span className="font-mono text-[11px] text-[var(--ink-dim)]">
                  Total: {formatUsd(calc.totalValue)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
