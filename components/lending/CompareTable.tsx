"use client";

import React, { useState } from "react";
import { Check, ShieldCheck, ArrowUpDown, ExternalLink, ShieldAlert, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { StockLendingOption } from "@/lib/lending/unified-comparison";

interface CompareTableProps {
  options: StockLendingOption[];
  onOpenSupply: (option: StockLendingOption) => void;
  onOpenBorrow: (option: StockLendingOption) => void;
}

function formatCompactUsd(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default function CompareTable({
  options,
  onOpenSupply,
  onOpenBorrow,
}: CompareTableProps) {
  const [sortBy, setSortBy] = useState<"supply" | "borrow" | "ltv" | "liquidity" | "risk">("supply");
  const [sortAsc, setSortAsc] = useState(false);

  const displayOptions = options || [];

  // If this stock does not yet have active protocol pools on Base mainnet
  if (displayOptions.length === 0) {
    return (
      <div className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-8 text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20">
          <ShieldAlert size={24} />
        </div>
        <div className="space-y-1.5 max-w-lg mx-auto">
          <h3 className="text-base font-bold text-[var(--ink)]">
            No Verified Lending or Staking Pools on Base
          </h3>
          <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
            Protocol curators (Beefy, Aerodrome, Morpho) have not yet initialized liquidity pools or lending markets for this stock on Base mainnet. To protect real user funds, only 100% verified on-chain contracts are listed.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/swap"
            className="px-4 py-2 rounded-xl bg-[var(--brand)] text-white text-xs font-bold hover:opacity-90 transition shadow-xs flex items-center gap-1.5"
          >
            <span>Trade on Swap</span>
            <ArrowRight size={13} />
          </Link>
          <Link
            href="/lend"
            className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] text-xs font-bold hover:border-[var(--brand)] hover:text-[var(--brand-text)] transition"
          >
            Explore Supported Stocks
          </Link>
        </div>
      </div>
    );
  }

  // Identify best-in-column values
  const maxSupply = Math.max(...displayOptions.map((o) => o.supplyApy));
  const validBorrows = displayOptions.map((o) => o.borrowApr).filter((b): b is number => b !== null && b > 0);
  const minBorrow = validBorrows.length > 0 ? Math.min(...validBorrows) : null;
  const maxLiquidity = Math.max(...displayOptions.map((o) => o.availableLiquidityUsd));
  const validLtvs = displayOptions.map((o) => o.maxLtv).filter((l): l is number => l !== null && l > 0);
  const maxLtv = validLtvs.length > 0 ? Math.max(...validLtvs) : null;

  const sortedOptions = [...displayOptions].sort((a, b) => {
    let diff = 0;
    if (sortBy === "supply") {
      diff = a.supplyApy - b.supplyApy;
    } else if (sortBy === "borrow") {
      const aVal = a.borrowApr ?? 999;
      const bVal = b.borrowApr ?? 999;
      diff = aVal - bVal;
    } else if (sortBy === "ltv") {
      diff = (a.maxLtv ?? 0) - (b.maxLtv ?? 0);
    } else if (sortBy === "liquidity") {
      diff = a.availableLiquidityUsd - b.availableLiquidityUsd;
    } else if (sortBy === "risk") {
      diff = a.riskScore - b.riskScore;
    }
    return sortAsc ? diff : -diff;
  });

  const toggleSort = (field: "supply" | "borrow" | "ltv" | "liquidity" | "risk") => {
    if (sortBy === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortBy(field);
      // First click on borrow and risk is ascending (lowest rate / lowest risk)
      // First click on supply, ltv, liquidity is descending (highest yield / highest limit)
      setSortAsc(field === "borrow" || field === "risk");
    }
  };

  return (
    <div className="w-full overflow-x-auto max-h-[75vh] overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs">
      <table className="w-full text-left border-collapse min-w-[750px]">
        <thead className="sticky top-0 z-20 bg-[var(--surface)]">
          <tr className="border-b border-[var(--border-subtle)] text-[11px] font-black uppercase tracking-wider text-[var(--ink-muted)]">
            {/* Sticky first column */}
            <th className="py-3.5 px-4 sticky left-0 z-30 bg-[var(--surface)] shadow-r">Protocol</th>
            <th className="py-3.5 px-3 bg-[var(--surface)]">Type</th>
            <th
              onClick={() => toggleSort("supply")}
              className="py-3.5 px-3 cursor-pointer hover:text-[var(--ink)] select-none text-emerald-600 dark:text-emerald-400 bg-[var(--surface)]"
            >
              <span className="inline-flex items-center gap-1">Supply APY <ArrowUpDown size={11} /></span>
            </th>
            <th
              onClick={() => toggleSort("borrow")}
              className="py-3.5 px-3 cursor-pointer hover:text-[var(--ink)] select-none bg-[var(--surface)]"
            >
              <span className="inline-flex items-center gap-1">Borrow APR <ArrowUpDown size={11} /></span>
            </th>
            <th
              onClick={() => toggleSort("ltv")}
              className="py-3.5 px-3 cursor-pointer hover:text-[var(--ink)] select-none bg-[var(--surface)]"
            >
              <span className="inline-flex items-center gap-1">Max LTV <ArrowUpDown size={11} /></span>
            </th>
            <th
              onClick={() => toggleSort("liquidity")}
              className="py-3.5 px-3 cursor-pointer hover:text-[var(--ink)] select-none bg-[var(--surface)]"
            >
              <span className="inline-flex items-center gap-1">Liquidity <ArrowUpDown size={11} /></span>
            </th>
            <th
              onClick={() => toggleSort("risk")}
              className="py-3.5 px-3 cursor-pointer hover:text-[var(--ink)] select-none bg-[var(--surface)]"
            >
              <span className="inline-flex items-center gap-1">Risk <ArrowUpDown size={11} /></span>
            </th>
            <th className="py-3.5 px-4 text-right bg-[var(--surface)]">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]/60 text-xs">
          {sortedOptions.map((opt) => {
            const isBestSupply = opt.supplyApy === maxSupply && maxSupply > 0;
            const isBestBorrow = minBorrow !== null && opt.borrowApr === minBorrow;
            const isDeepest = opt.availableLiquidityUsd === maxLiquidity && maxLiquidity > 0;
            const isHighestLtv = maxLtv !== null && opt.maxLtv === maxLtv;

            return (
              <tr key={opt.id} className="pop-row group transition">
                {/* Sticky Protocol Column */}
                <td className="py-3.5 px-4 sticky left-0 z-10 bg-[var(--surface)] group-hover:bg-[var(--surface-2)] shadow-r">
                  <div>
                    <span className="font-bold text-sm text-[var(--ink)]">{opt.protocolName}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <a
                        href={`https://basescan.org/address/${opt.contractAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[var(--ink-muted)] hover:text-[var(--brand-text)] flex items-center gap-0.5"
                      >
                        <span>Contract</span> <ExternalLink size={9} />
                      </a>
                      {opt.sourceLink && (
                        <a
                          href={opt.sourceLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-[var(--brand-text)] hover:underline flex items-center gap-0.5 font-semibold"
                        >
                          <span>Official App</span> <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                  </div>
                </td>

                {/* Type Badge */}
                <td className="py-3.5 px-3">
                  <div className="flex flex-col gap-1 items-start">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
                      {opt.kindChip || opt.typeLabel}
                    </span>
                    {opt.isLowLiquidity && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Low liquidity
                      </span>
                    )}
                  </div>
                </td>

                {/* Supply APY */}
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-1.5 font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                    <span>
                      {opt.supplyApy > 0
                        ? `${opt.supplyApy.toFixed(2)}%`
                        : opt.availableLiquidityUsd > 0 && opt.role === "lp_vault"
                          ? "0.00%"
                          : "—"}
                    </span>
                    {isBestSupply && (
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center" title="Best Supply APY">
                        <Check size={9} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  {opt.supplyApy === 0 && (opt.borrowApr !== null || (opt.maxLtv !== null && opt.maxLtv > 0)) && (
                    <span className="text-[10px] text-[var(--ink-muted)] block font-medium">Collateral Only</span>
                  )}
                  {opt.role === "lp_vault" && (
                    <span className="text-[9px] text-[var(--ink-muted)] block">Pair with USDC</span>
                  )}
                </td>

                {/* Borrow APR */}
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-[var(--ink)]">
                    <span>{opt.borrowApr !== null && opt.borrowApr > 0 ? `${opt.borrowApr.toFixed(2)}%` : "—"}</span>
                    {isBestBorrow && (
                      <span className="w-3.5 h-3.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center" title="Lowest Borrow APR">
                        <Check size={9} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </td>

                {/* Max LTV */}
                <td className="py-3.5 px-3 font-mono text-[var(--ink)]">
                  <div className="flex items-center gap-1.5">
                    <span>{opt.maxLtv !== null ? `${opt.maxLtv}%` : "—"}</span>
                    {isHighestLtv && (
                      <span className="w-3.5 h-3.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center" title="Highest LTV">
                        <Check size={9} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </td>

                {/* Available Liquidity */}
                <td className="py-3.5 px-3 font-mono text-[var(--ink)]">
                  <div className="flex items-center gap-1.5">
                    <span>{opt.availableLiquidityUsd > 0 ? formatCompactUsd(opt.availableLiquidityUsd) : "—"}</span>
                    {isDeepest && (
                      <span className="w-3.5 h-3.5 rounded-full bg-purple-500/20 text-purple-600 flex items-center justify-center" title="Deepest Liquidity">
                        <Check size={9} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </td>

                {/* Risk */}
                <td className="py-3.5 px-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      opt.riskLevel === "low"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : opt.riskLevel === "medium"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                    }`}
                  >
                    <ShieldCheck size={11} />
                    <span className="capitalize">{opt.riskLevel}</span>
                  </span>
                </td>

                {/* Action Buttons */}
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenSupply(opt)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--brand)] text-white font-bold text-[11px] shadow-xs hover:opacity-90 transition cursor-pointer active:scale-[0.98]"
                    >
                      {opt.type === "strategy" ? "Deposit to Strategy" : "Supply"}
                    </button>
                    {opt.borrowApr !== null && opt.borrowApr > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenBorrow(opt)}
                        className="pop-pill px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] font-bold text-[11px] text-[var(--ink)] hover:border-[var(--brand)] cursor-pointer"
                      >
                        Borrow
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
