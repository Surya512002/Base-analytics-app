"use client";

import React, { useState } from "react";
import {
  Clock,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";
import { FEATURES } from "@/lib/constants/features";
import {
  computeNavSpread,
  getEquityMarketStatus,
  type StockNavComparison,
} from "@/lib/stocks/nav-tracker";
import type { CoinbaseTokenizedStock } from "@/lib/stocks/coinbase-api";

interface StockNavTrackerProps {
  stocks: CoinbaseTokenizedStock[];
  className?: string;
}

export default function StockNavTracker({
  stocks,
  className = "",
}: StockNavTrackerProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    stocks[0]?.symbol || "NVDAc"
  );

  // Feature flag check
  if (!FEATURES.STOCK_NAV_TRACKER) {
    return null;
  }

  const marketStatus = getEquityMarketStatus();
  const selectedStock = stocks.find((s) => s.symbol === selectedSymbol) ?? stocks[0];

  // In tokenized stocks, dexPriceUsd reflects 24/7 AMM pool trading, and nav is 24/5 official custodian NAV
  const comparison: StockNavComparison | null = selectedStock
    ? computeNavSpread({
        symbol: selectedStock.symbol,
        name: selectedStock.name,
        contractAddress: selectedStock.address,
        dexPriceUsd:
          selectedStock.nav > 0
            ? Number((selectedStock.nav * (1 + (selectedStock.change24h || 0) / 100)).toFixed(2))
            : null,
        oracleNavUsd: selectedStock.nav > 0 ? selectedStock.nav : null,
      })
    : null;

  return (
    <div
      data-testid="stock-nav-tracker"
      className={`card-pop rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 space-y-4 shadow-xs ${className}`}
    >
      {/* Header with Market Hours Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center border border-[#0052FF]/20 shadow-xs shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-[var(--ink)]">Stock NAV Tracker</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0052FF] text-white">
                24/5 vs 24/7
              </span>
            </div>
            <p className="text-xs text-[var(--ink-muted)]">
              Real-time spread monitor: 24/5 Oracle NAV vs 24/7 Base AMM pool price
            </p>
          </div>
        </div>

        {/* Market Hours Status Chip */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
            marketStatus.isOpen
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              marketStatus.isOpen ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span>{marketStatus.statusText}</span>
        </div>
      </div>

      {/* Stock Selection Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
        {stocks.slice(0, 8).map((stk) => {
          const isSelected = stk.symbol === selectedSymbol;
          return (
            <button
              key={stk.symbol}
              type="button"
              onClick={() => setSelectedSymbol(stk.symbol)}
              className={`shrink-0 px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                isSelected
                  ? "bg-[var(--brand)] text-white shadow-xs"
                  : "bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {stk.symbol}
            </button>
          );
        })}
      </div>

      {/* NAV Comparison Card */}
      {!comparison || comparison.status === "unavailable" ? (
        <div className="p-5 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)]/30 text-center text-xs text-[var(--ink-muted)]">
          <p className="font-bold text-[var(--ink)]">NAV Feed Unavailable</p>
          <p className="text-[11px] mt-1">
            Oracle NAV feed for this equity token is temporarily unindexed on Base mainnet.
          </p>
        </div>
      ) : (
        <div className="p-4 sm:p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--ink-dim)]">
                Asset Pair
              </span>
              <h4 className="text-base font-black text-[var(--ink)]">
                {comparison.name} ({comparison.symbol})
              </h4>
            </div>

            <span
              className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                comparison.status === "par"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : comparison.status === "premium"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                    : "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
              }`}
            >
              {comparison.statusLabel}
            </span>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--ink-muted)] block">24/7 DEX AMM Pool Price</span>
              <span className="font-mono font-black text-sm text-[var(--ink)] mt-0.5 block">
                {comparison.dexPriceUsd !== null ? `$${comparison.dexPriceUsd.toFixed(2)}` : "Unavailable"}
              </span>
              <span className="text-[10px] text-[var(--ink-dim)]">Aerodrome / Uniswap</span>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--ink-muted)] block">24/5 Oracle / Custody NAV</span>
              <span className="font-mono font-black text-sm text-[var(--ink)] mt-0.5 block">
                {comparison.oracleNavUsd !== null ? `$${comparison.oracleNavUsd.toFixed(2)}` : "Unavailable"}
              </span>
              <span className="text-[10px] text-[var(--ink-dim)]">Backed Finance Custody</span>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--ink-muted)] block">Price vs. NAV Spread</span>
              <div className="flex items-center gap-1 font-mono font-black text-sm mt-0.5">
                {comparison.spreadPct !== null && comparison.spreadPct >= 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                    <TrendingUp size={13} />
                    +{comparison.spreadPct.toFixed(2)}% (+${comparison.spreadUsd?.toFixed(2)})
                  </span>
                ) : comparison.spreadPct !== null ? (
                  <span className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                    <TrendingDown size={13} />
                    {comparison.spreadPct.toFixed(2)}% (${comparison.spreadUsd?.toFixed(2)})
                  </span>
                ) : (
                  <span className="text-[var(--ink-dim)]">Unavailable</span>
                )}
              </div>
              <span className="text-[10px] text-[var(--ink-dim)]">Tracking Variance</span>
            </div>
          </div>

          {/* Market Hours Warning & Custody Attestation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-[var(--ink-muted)]">
            <div className="flex items-center gap-1.5">
              <Info size={13} className="text-[var(--brand-text)] shrink-0" />
              <span>{comparison.marketHoursNote}</span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <a
                href={comparison.attestationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--brand-text)] hover:underline font-bold text-[11px]"
              >
                <ShieldCheck size={13} />
                <span>Custody Attestations</span>
                <ExternalLink size={10} />
              </a>
              <a
                href={comparison.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--ink-muted)] hover:text-[var(--ink)] text-[11px]"
              >
                <span>BaseScan</span>
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
