"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Check,
  Clock,
  Info,
  ChevronRight,
  TrendingUp,
  Lock,
} from "lucide-react";
import type { StockLendingOption } from "@/lib/lending/unified-comparison";
import { getRiskCriteriaExplanation } from "@/lib/lending/protocol-adapter-interface";

interface ProtocolCardProps {
  option: StockLendingOption;
  isBest?: boolean;
  onOpenSupply: () => void;
  onOpenBorrow: () => void;
  onOpenDetails: () => void;
}

function formatCompactUsd(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default function ProtocolCard({
  option,
  isBest = false,
  onOpenSupply,
  onOpenBorrow,
  onOpenDetails,
}: ProtocolCardProps) {
  const [showRiskTooltip, setShowRiskTooltip] = useState(false);
  const riskInfo = getRiskCriteriaExplanation(option.riskLevel);

  const canBorrow = option.borrowApr !== null && option.borrowApr > 0;
  const isFixedTerm = option.type === "fixed" && option.fixedTermDays;

  return (
    <div
      className={`pop-lg rounded-2xl border transition relative flex flex-col justify-between p-5 space-y-4 ${
        isBest
          ? "border-[var(--brand)] bg-[var(--surface)] shadow-sm ring-1 ring-[var(--brand)]/20"
          : "border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs"
      }`}
    >
      {/* 1. Card Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-sm text-[var(--ink)]">{option.protocolName}</h3>
            {isBest && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--border-subtle)] text-[10px] font-bold">
                <Check size={11} strokeWidth={3} /> Best Rate
              </span>
            )}
          </div>

          {/* Type Badge */}
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
            {option.typeLabel}
          </span>
        </div>

        {/* 2-line clamped description with Details button */}
        <p className="text-xs text-[var(--ink-muted)] line-clamp-2 leading-relaxed">
          {option.type === "fixed"
            ? `Morpho Midnight 60-day fixed duration market for ${option.stockSymbol}. Locks in a guaranteed fixed APR until maturity.`
            : option.type === "strategy"
              ? `Superform SuperStocks automated yield vault. Accumulates securities lending fees and Base rewards automatically.`
              : `Isolated lending pool on Base mainnet. Deposit ${option.stockSymbol} as collateral to borrow USDC.`}
        </p>
        <button
          type="button"
          onClick={onOpenDetails}
          className="text-[11px] font-bold text-[var(--brand-text)] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
        >
          <span>Market details</span>
          <ChevronRight size={11} />
        </button>
      </div>

      {/* 2. Two Primary Metrics */}
      <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
        <div>
          <span className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider block">
            Supply APY
          </span>
          <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
            {option.supplyApy > 0 ? `${option.supplyApy.toFixed(2)}%` : "0.00%"}
          </p>
          <span className="text-[10px] text-[var(--ink-dim)]">Securities yield</span>
        </div>

        <div>
          <span className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider block">
            Borrow APR
          </span>
          <p className="text-lg font-black font-mono text-[var(--ink)] mt-0.5">
            {canBorrow ? `${option.borrowApr!.toFixed(2)}%` : "—"}
          </p>
          <span className="text-[10px] text-[var(--ink-dim)]">
            {canBorrow ? (isFixedTerm ? "Fixed 60-day rate" : "Variable cost") : "Collateral only"}
          </span>
        </div>
      </div>

      {/* 3. Secondary Metrics: Max LTV, Liquidity, Utilization, Risk */}
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-3 gap-2 text-center text-[var(--ink-muted)]">
          <div className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)]/60">
            <span className="text-[9px] uppercase font-bold text-[var(--ink-dim)] block">Max LTV</span>
            <span className="font-mono font-bold text-[var(--ink)] text-xs">
              {option.maxLtv !== null ? `${option.maxLtv}%` : "—"}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)]/60">
            <span className="text-[9px] uppercase font-bold text-[var(--ink-dim)] block">Liquidity</span>
            <span className="font-mono font-bold text-[var(--ink)] text-xs">
              {formatCompactUsd(option.availableLiquidityUsd)}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)]/60">
            <span className="text-[9px] uppercase font-bold text-[var(--ink-dim)] block">Utilization</span>
            <span className="font-mono font-bold text-[var(--ink)] text-xs">
              {option.utilization > 0 ? `${option.utilization.toFixed(1)}%` : "—"}
            </span>
          </div>
        </div>

        {/* Risk Badge with Interactive Tooltip */}
        <div className="relative pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--ink-muted)] font-medium">Protocol Risk Rating:</span>
            <button
              type="button"
              onClick={() => setShowRiskTooltip((p) => !p)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] cursor-pointer ${
                option.riskLevel === "low"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : option.riskLevel === "medium"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              }`}
            >
              <ShieldCheck size={11} />
              <span className="capitalize">{option.riskLevel} Risk</span>
              <Info size={10} className="ml-0.5 opacity-70" />
            </button>
          </div>

          {/* Risk Details Tooltip / Popover */}
          {showRiskTooltip && (
            <div className="absolute bottom-full mb-2 left-0 right-0 z-30 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-lg text-[11px] space-y-1.5 animate-meridian-fade">
              <div className="flex items-center justify-between font-bold text-[var(--ink)]">
                <span>{riskInfo.title}</span>
                <button
                  type="button"
                  onClick={() => setShowRiskTooltip(false)}
                  className="text-[var(--ink-muted)] hover:text-[var(--ink)] text-xs"
                >
                  ✕
                </button>
              </div>
              <p className="text-[var(--ink-muted)] leading-relaxed">{riskInfo.summary}</p>
              <div className="pt-1 border-t border-[var(--border-subtle)] text-[10px] space-y-0.5 text-[var(--ink-dim)]">
                <p>• {riskInfo.auditStatus}</p>
                <p>• {riskInfo.oracleModel}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Action Buttons */}
      <div className="pt-2 border-t border-[var(--border-subtle)]/60 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {/* Primary Action Button (Supply / Strategy Deposit) */}
          <button
            type="button"
            onClick={onOpenSupply}
            className="py-2.5 px-3 rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--brand-hover)] font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
          >
            <span>{option.type === "strategy" ? "Deposit to Strategy" : "Supply"}</span>
          </button>

          {/* Secondary Action Button (Borrow) */}
          <button
            type="button"
            disabled={!canBorrow}
            onClick={onOpenBorrow}
            className={`pop-pill py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              canBorrow
                ? "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--brand)] hover:text-[var(--brand-text)] cursor-pointer"
                : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-dim)] cursor-not-allowed opacity-50"
            }`}
          >
            <span>Borrow</span>
          </button>
        </div>

        {/* Data Source & Timestamp */}
        <div className="flex items-center justify-between text-[10px] text-[var(--ink-dim)] pt-0.5">
          <a
            href={`https://basescan.org/address/${option.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--brand-text)] inline-flex items-center gap-1"
          >
            <span>Contract verified</span>
            <ExternalLink size={9} />
          </a>
          <span>updated live</span>
        </div>
      </div>
    </div>
  );
}
