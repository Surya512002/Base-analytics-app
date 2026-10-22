"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  LayoutGrid,
  Table as TableIcon,
  TrendingUp,
  Lock,
  Layers,
  Clock,
  ShieldCheck,
  Wallet,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import type { StockLendingComparison, StockLendingOption } from "@/lib/lending/unified-comparison";
import ProtocolCard from "./ProtocolCard";
import CompareTable from "./CompareTable";
import { isUSMarketOpenNow } from "@/lib/launchpad/launch-configs";
import TokenLogo from "@/components/ui/TokenLogo";

interface AssetDetailViewProps {
  comparison: StockLendingComparison;
  onBack: () => void;
  isConnected: boolean;
  onRequestConnect?: () => void;
  walletBalance?: number | null;
  walletBalanceUsd?: number | null;
  onOpenSupply: (option: StockLendingOption) => void;
  onOpenBorrow: (option: StockLendingOption) => void;
  onOpenDetails: (option: StockLendingOption) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function formatCompactUsd(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default function AssetDetailView({
  comparison,
  onBack,
  isConnected,
  onRequestConnect,
  walletBalance = null,
  walletBalanceUsd = null,
  onOpenSupply,
  onOpenBorrow,
  onOpenDetails,
  onRefresh,
  isRefreshing = false,
}: AssetDetailViewProps) {
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [showMiniHeader, setShowMiniHeader] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  const isMarketOpen = isUSMarketOpenNow();

  // Sticky mini-header on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!headerRef.current) return;
      const rect = headerRef.current.getBoundingClientRect();
      setShowMiniHeader(rect.bottom < 60);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const bestSupply = comparison.bestSupplyOption;
  const bestBorrow = comparison.bestBorrowOption;
  const deepest = comparison.highestLiquidityOption;

  return (
    <div className="space-y-6 animate-meridian-fade">
      {/* Sticky Mini Header on Scroll */}
      {showMiniHeader && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] px-4 py-2.5 shadow-sm animate-meridian-rise">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className="p-1 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-[var(--ink)]">
                  {comparison.stockSymbol}
                </span>
                <span className="font-mono text-xs text-[var(--ink-muted)]">
                  ${comparison.navUsd.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {bestSupply && (
                <button
                  type="button"
                  onClick={() => onOpenSupply(bestSupply)}
                  className="px-3 py-1 rounded-lg bg-[#0052FF] text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Supply ({bestSupply.supplyApy.toFixed(1)}%)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--brand-text)] transition cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Back to Markets Overview</span>
      </button>

      {/* Main Asset Header Card */}
      <div
        ref={headerRef}
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <TokenLogo
              address={comparison.stockAddress}
              symbol={comparison.stockSymbol}
              size={56}
              shape="rounded-xl"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-[var(--ink)]">
                  {comparison.stockName}
                </h1>
                <span className="font-mono text-sm font-bold text-[var(--brand-text)]">
                  ${comparison.stockSymbol}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)] mt-0.5">
                <span className="font-mono font-bold text-[var(--ink)]">
                  ${comparison.navUsd.toFixed(2)}
                </span>
                <span>·</span>
                <span>Chainlink 24/5 Base Mainnet Equity Feed</span>
              </div>
            </div>
          </div>

          {/* Right badges & Wallet Balance */}
          <div className="flex flex-col sm:items-end gap-1.5">
            {/* Market Status chip */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold w-fit ${
                isMarketOpen
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              }`}
            >
              <Clock size={12} />
              <span>{isMarketOpen ? "Market Open" : "Market Closed (24/5 Feed)"}</span>
            </span>

            {/* Wallet Balance */}
            <div className="text-xs text-[var(--ink-muted)]">
              {!isConnected ? (
                <button
                  type="button"
                  onClick={onRequestConnect}
                  className="text-[var(--brand-text)] font-bold hover:underline cursor-pointer"
                >
                  Connect wallet to view balance
                </button>
              ) : walletBalance !== null ? (
                <span>
                  Your Balance:{" "}
                  <strong className="text-[var(--ink)] font-mono">
                    {walletBalance.toFixed(3)} {comparison.stockSymbol}
                  </strong>
                  {walletBalanceUsd !== null && (
                    <span className="text-[var(--ink-dim)]"> (${walletBalanceUsd.toFixed(2)})</span>
                  )}
                </span>
              ) : (
                <span>Balance: —</span>
              )}
            </div>
          </div>
        </div>

        {/* 3 Summary Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--border-subtle)]/60">
          {/* 1. Top Supply Yield */}
          <div className="pop p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] flex flex-col justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)] block">
                Top Supply Yield
              </span>
              <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                {bestSupply ? `${bestSupply.supplyApy.toFixed(2)}%` : "—"}
              </p>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                {bestSupply?.protocolName ?? "No pool available"}
              </p>
            </div>
            {bestSupply && (
              <button
                type="button"
                onClick={() => onOpenSupply(bestSupply)}
                className="py-1.5 px-3 rounded-lg bg-[#0052FF] text-white font-bold text-xs shadow-xs transition cursor-pointer self-start active:scale-[0.98]"
              >
                {bestSupply.type === "strategy" ? "Deposit to Strategy" : "Supply Now"}
              </button>
            )}
          </div>

          {/* 2. Lowest Borrow Rate */}
          <div className="pop p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] flex flex-col justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)] block">
                Lowest Borrow Rate
              </span>
              <p className="text-xl font-black font-mono text-[var(--ink)] mt-0.5">
                {bestBorrow && bestBorrow.borrowApr !== null ? `${bestBorrow.borrowApr.toFixed(2)}%` : "—"}
              </p>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                {bestBorrow?.protocolName ?? "Collateral only"}
              </p>
            </div>
            {bestBorrow && (
              <button
                type="button"
                onClick={() => onOpenBorrow(bestBorrow)}
                className="pop-pill py-1.5 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] font-bold text-xs hover:border-[var(--brand)] hover:text-[var(--brand-text)] transition cursor-pointer self-start"
              >
                Borrow USDC
              </button>
            )}
          </div>

          {/* 3. Deepest Liquidity Pool */}
          <div className="pop p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] flex flex-col justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)] block">
                Deepest Pool
              </span>
              <p className="text-xl font-black font-mono text-[var(--ink)] mt-0.5">
                {deepest ? formatCompactUsd(deepest.availableLiquidityUsd) : "—"}
              </p>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                {deepest?.protocolName ?? "Morpho Blue"}
              </p>
            </div>
            {deepest && (
              <button
                type="button"
                onClick={() => onOpenDetails(deepest)}
                className="pop-pill py-1.5 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] font-bold text-xs hover:border-[var(--brand)] transition cursor-pointer self-start"
              >
                View Protocol
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View Toggle Bar (Cards vs Compare Table) */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-[var(--ink)]">Available Protocol Markets</h2>
          <p className="text-xs text-[var(--ink-muted)]">
            Compare live parameters across Superform, Morpho, Euler, Moonwell, and Aave
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === "cards"
                ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs border border-[var(--border-subtle)]"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <LayoutGrid size={13} />
            <span>Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === "table"
                ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs border border-[var(--border-subtle)]"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <TableIcon size={13} />
            <span>Compare Table</span>
          </button>
        </div>
      </div>

      {/* Protocol Markets Display */}
      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {comparison.options.map((opt) => (
            <ProtocolCard
              key={opt.id}
              option={opt}
              isBest={opt.id === bestSupply?.id || opt.id === bestBorrow?.id}
              onOpenSupply={() => onOpenSupply(opt)}
              onOpenBorrow={() => onOpenBorrow(opt)}
              onOpenDetails={() => onOpenDetails(opt)}
            />
          ))}
        </div>
      ) : (
        <CompareTable
          options={comparison.options}
          onOpenSupply={onOpenSupply}
          onOpenBorrow={onOpenBorrow}
        />
      )}
    </div>
  );
}
