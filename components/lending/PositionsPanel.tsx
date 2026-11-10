"use client";

import React from "react";
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  RefreshCw,
  Wallet,
} from "lucide-react";
import type { UserProtocolPosition } from "@/lib/lending/user-positions";
import { HEALTH_THRESHOLDS } from "@/lib/lending/user-positions";
import LiquidationGuardBanner from "./LiquidationGuardBanner";

export interface PositionsPanelProps {
  isConnected: boolean;
  isWrongNetwork?: boolean;
  onSwitchNetwork?: () => void;
  isLoading?: boolean;
  positions?: UserProtocolPosition[];
  errors?: Record<string, string>;
  onRetryProtocol?: (protocol: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdatedSecondsAgo?: number;
  onRequestConnect?: () => void;
  onOpenAction?: (
    marketId: string,
    action: "supply" | "withdraw" | "borrow" | "repay" | "stake" | "unstake"
  ) => void;
  isMockData?: boolean;
}

export default function PositionsPanel({
  isConnected,
  isWrongNetwork = false,
  onSwitchNetwork,
  isLoading = false,
  positions = [],
  errors = {},
  onRetryProtocol,
  onRefresh,
  isRefreshing = false,
  lastUpdatedSecondsAgo = 0,
  onRequestConnect,
  onOpenAction,
  isMockData = false,
}: PositionsPanelProps) {
  // Aggregate real totals
  const totalSuppliedUsd = positions.reduce((acc, p) => acc + p.suppliedUsd, 0);
  const totalBorrowedUsd = positions.reduce((acc, p) => acc + p.borrowedUsd, 0);

  // Net APY calculated from real positions
  const netUsd = totalSuppliedUsd - totalBorrowedUsd;
  const weightedSupplyApy = positions.reduce(
    (acc, p) => acc + p.suppliedUsd * (p.apy || 0),
    0
  );
  const weightedBorrowApr = positions.reduce(
    (acc, p) => acc + p.borrowedUsd * (p.apr || 0),
    0
  );
  const netApy =
    totalSuppliedUsd > 0
      ? (weightedSupplyApy - weightedBorrowApr) / Math.max(1, netUsd)
      : 0;

  // Aggregate health factor only when debt exists
  let overallHealthFactor: number | null = null;
  if (totalBorrowedUsd > 0) {
    const debtPositions = positions.filter((p) => p.borrowedUsd > 0 && p.healthFactor !== null);
    if (debtPositions.length > 0) {
      // Find minimum health factor among debt positions (standard risk metric)
      overallHealthFactor = Math.min(...debtPositions.map((p) => p.healthFactor!));
    }
  }

  // Health Status Chip determination
  const healthStatus: "Safe" | "Watch" | "At risk" =
    overallHealthFactor === null || overallHealthFactor >= HEALTH_THRESHOLDS.SAFE
      ? "Safe"
      : overallHealthFactor >= HEALTH_THRESHOLDS.WATCH
        ? "Watch"
        : "At risk";

  const errorKeys = Object.keys(errors);
  const hasPositions = positions.length > 0;

  // ─────────────────────────────────────────────────────────────
  // A. NOT CONNECTED STATE (Compact, clean banner)
  // ─────────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-xs space-y-3 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center border border-[var(--brand)]/20 shrink-0">
              <Wallet size={16} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-[var(--ink)]">Your Positions &amp; Health</h3>
              <p className="text-[11px] text-[var(--ink-muted)]">
                Connect your wallet on Base to query live collateral deposits, debt, and gauge positions.
              </p>
            </div>
          </div>
          {onRequestConnect && (
            <button
              type="button"
              onClick={onRequestConnect}
              className="pop-pill px-3.5 py-1.5 rounded-xl bg-[var(--brand)] text-white hover:opacity-90 text-xs font-bold shadow-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Wallet size={13} />
              <span>Connect Wallet</span>
            </button>
          )}
        </div>

        {/* Liquidation Guard Simulator Preview */}
        <LiquidationGuardBanner
          positions={[]}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // B. WRONG NETWORK STATE (Compact warning)
  // ─────────────────────────────────────────────────────────────
  if (isWrongNetwork) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-[var(--ink)] font-medium">
            Please switch your wallet to <strong>Base mainnet</strong> (Chain ID 8453) to load on-chain positions.
          </span>
        </div>
        {onSwitchNetwork && (
          <button
            type="button"
            onClick={onSwitchNetwork}
            className="pop-pill px-3.5 py-1.5 rounded-xl bg-[var(--brand)] text-white text-xs font-bold shadow-xs transition shrink-0 cursor-pointer"
          >
            Switch to Base
          </button>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // C. SKELETON LOADING STATE (Compact shimmer)
  // ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-xs flex items-center justify-between animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[var(--border-subtle)]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-36 bg-[var(--border-subtle)] rounded" />
            <div className="h-2.5 w-56 bg-[var(--border-subtle)] rounded" />
          </div>
        </div>
        <div className="h-7 w-20 bg-[var(--border-subtle)] rounded-xl" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // D. PROTOCOL READ FAILURE (When 0 positions found due to RPC error)
  // ─────────────────────────────────────────────────────────────
  if (!hasPositions && errorKeys.length > 0) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-[var(--ink)]">
            Base RPC query error: Couldn&apos;t read {errorKeys.join(", ")} positions.
          </span>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="pop-pill px-3 py-1 rounded-xl bg-[var(--brand)] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // E. ZERO POSITIONS STATE (Small & Simple with Liquidation Guard Simulator)
  // ─────────────────────────────────────────────────────────────
  if (!hasPositions) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-xs space-y-3 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-[var(--ink)]">Your Positions &amp; Health</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Safe · No Debt
                </span>
                {isMockData && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                    Demo
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--ink-muted)]">
                No active loans, collateral, or gauge deposits on Base mainnet.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                const el =
                  document.getElementById("lending-view-tabs") ||
                  document.getElementById("market-opportunities");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className="pop-pill px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--brand-text)] hover:border-[var(--brand)] text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <span>Explore Markets</span>
              <span>↓</span>
            </button>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="pop-pill p-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--brand)] transition cursor-pointer"
                title={lastUpdatedSecondsAgo > 0 ? `Updated ${lastUpdatedSecondsAgo}s ago` : "Refresh positions"}
              >
                <RefreshCw size={13} className={isRefreshing ? "animate-spin text-[var(--brand-text)]" : ""} />
              </button>
            )}
          </div>
        </div>

        {/* Liquidation Guard Banner with Simulate Drop */}
        <LiquidationGuardBanner
          positions={positions}
          onOpenAction={onOpenAction}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // F. ACTIVE POSITIONS STATE (Full management panel when user has open positions)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs space-y-4">
      {/* 1. Header with title, health badge, refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]/60">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)]">
            <ShieldCheck size={18} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-[var(--ink)]">Your Positions &amp; Health</h2>
              {isMockData && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                  Demo Data
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--ink-muted)]">
              Verified on-chain collateral, debt, and gauge positions on Base mainnet
            </p>
          </div>
        </div>

        {/* Right Header Status: Health Chip & Refresh */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--ink-muted)]">Health:</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 ${
                healthStatus === "Safe"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : healthStatus === "Watch"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
              }`}
            >
              {healthStatus === "Safe" ? (
                <ShieldCheck size={13} />
              ) : healthStatus === "Watch" ? (
                <AlertTriangle size={13} />
              ) : (
                <AlertCircle size={13} />
              )}
              <span>
                {overallHealthFactor !== null
                  ? `${overallHealthFactor.toFixed(2)} · ${healthStatus}`
                  : "Safe (No Debt)"}
              </span>
            </span>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="pop-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[11px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--brand)] transition cursor-pointer"
            >
              <RefreshCw size={11} className={isRefreshing ? "animate-spin text-[var(--brand-text)]" : ""} />
              <span>{lastUpdatedSecondsAgo > 0 ? `${lastUpdatedSecondsAgo}s ago` : "Live"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Demo Data Warning Banner (When Dev Flag Is Active) */}
      {isMockData && (
        <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Demo Data Active:</strong> Simulated positions are visible because{" "}
              <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">
                NEXT_PUBLIC_USE_MOCK_POSITIONS=true
              </code>
              . In production, only verified on-chain positions appear.
            </span>
          </div>
        </div>
      )}

      {/* Partial Protocol Failure Banner */}
      {errorKeys.length > 0 && (
        <div className="space-y-1.5">
          {errorKeys.map((protocol) => (
            <div
              key={protocol}
              className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-[var(--ink-muted)] flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5">
                <AlertCircle size={13} className="text-amber-500 shrink-0" />
                <span>Couldn&apos;t load {protocol} positions from Base RPC.</span>
              </div>
              {onRetryProtocol && (
                <button
                  type="button"
                  onClick={() => onRetryProtocol(protocol)}
                  className="px-2 py-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] font-bold text-[11px] hover:border-[var(--brand)] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={10} />
                  <span>Retry</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 2. Liquidation Guard Banner (ONLY shown when user has active debt!) */}
      {totalBorrowedUsd > 0 && (
        <LiquidationGuardBanner positions={positions} onOpenAction={onOpenAction} />
      )}

      {/* 3. Real Overview Metric Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="pop p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <span className="text-[11px] text-[var(--ink-muted)]">Total Supplied</span>
          <p className="text-sm font-mono font-black text-[var(--ink)] mt-0.5">
            ${totalSuppliedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="pop p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <span className="text-[11px] text-[var(--ink-muted)]">Total Borrowed</span>
          <p className="text-sm font-mono font-black text-[var(--ink)] mt-0.5">
            ${totalBorrowedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="pop p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <span className="text-[11px] text-[var(--ink-muted)]">Net APY</span>
          <p className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {netApy > 0 ? `+${netApy.toFixed(2)}%` : `${netApy.toFixed(2)}%`}
          </p>
        </div>

        <div className="pop p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <span className="text-[11px] text-[var(--ink-muted)]">Active Markets</span>
          <p className="text-sm font-mono font-black text-[var(--brand-text)] mt-0.5">
            {positions.length} Positions
          </p>
        </div>
      {/* 4. Real On-chain Positions Rows */}
      <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--ink-muted)] px-1">
            <span>Asset &amp; Protocol</span>
            <span>Position &amp; Actions</span>
          </div>

          <div className="space-y-2">
            {positions.map((pos) => (
              <div
                key={pos.id}
                className="pop-row flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs gap-3"
              >
                {/* Left: Asset, Protocol, Amounts */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[var(--ink)] text-sm">{pos.assetSymbol}</span>
                    <span className="text-[10px] text-[var(--ink-muted)]">· {pos.protocolName}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        pos.type === "supplied"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : pos.type === "borrowed"
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                      }`}
                    >
                      {pos.protocolBadge}
                    </span>
                    <a
                      href={pos.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--ink-muted)] hover:text-[var(--brand-text)] transition inline-flex items-center"
                      title="View contract on Basescan"
                    >
                      <ExternalLink size={11} />
                    </a>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-[var(--ink-muted)] font-mono flex-wrap">
                    <span>
                      Supplied:{" "}
                      <strong className="text-[var(--ink)]">
                        {pos.suppliedFormatted} (${pos.suppliedUsd.toFixed(2)})
                      </strong>
                    </span>

                    {pos.borrowedUsd > 0 && (
                      <span>
                        Borrowed:{" "}
                        <strong className="text-red-500">
                          {pos.borrowedFormatted} (${pos.borrowedUsd.toFixed(2)})
                        </strong>
                      </span>
                    )}

                    <span>
                      Rate:{" "}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {pos.apy.toFixed(2)}% APY
                      </strong>
                    </span>

                    {pos.borrowedUsd > 0 && pos.healthFactor !== null && (
                      <span>
                        Health:{" "}
                        <strong
                          className={
                            pos.healthFactor >= HEALTH_THRESHOLDS.SAFE
                              ? "text-emerald-600 dark:text-emerald-400"
                              : pos.healthFactor >= HEALTH_THRESHOLDS.WATCH
                                ? "text-amber-500"
                                : "text-red-500"
                          }
                        >
                          {pos.healthFactor.toFixed(2)}
                        </strong>
                      </span>
                    )}

                    {pos.pendingRewardsFormatted && (
                      <span>
                        Rewards:{" "}
                        <strong className="text-purple-600 dark:text-purple-400">
                          {pos.pendingRewardsFormatted}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Action Buttons */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                  {pos.canAdd && (
                    <button
                      type="button"
                      onClick={() => onOpenAction?.(pos.marketId, "supply")}
                      className="pop-pill px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] font-bold text-[11px] text-[var(--ink)] hover:border-[var(--brand)] cursor-pointer"
                    >
                      Add
                    </button>
                  )}

                  {pos.canWithdraw && (
                    <button
                      type="button"
                      onClick={() => onOpenAction?.(pos.marketId, "withdraw")}
                      className="pop-pill px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] font-bold text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      Withdraw
                    </button>
                  )}

                  {pos.canBorrow && (
                    <button
                      type="button"
                      onClick={() => onOpenAction?.(pos.marketId, "borrow")}
                      className="pop-pill px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] font-bold text-[11px] text-[var(--ink)] hover:border-[var(--brand)] cursor-pointer"
                    >
                      Borrow
                    </button>
                  )}

                  {pos.canRepay && (
                    <button
                      type="button"
                      onClick={() => onOpenAction?.(pos.marketId, "repay")}
                      className="pop-pill px-2.5 py-1 rounded-lg bg-[var(--brand)] hover:opacity-90 text-white font-bold text-[11px] shadow-xs cursor-pointer"
                    >
                      Repay
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
