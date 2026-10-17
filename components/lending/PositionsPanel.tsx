"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  RefreshCw,
  Wallet,
  ArrowRight,
  TrendingUp,
  Lock,
  Layers,
  Coins,
  CheckCircle2,
} from "lucide-react";
import type { UserProtocolPosition } from "@/lib/lending/user-positions";
import { HEALTH_THRESHOLDS } from "@/lib/lending/user-positions";

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

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs space-y-4">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER (Title, Health Badge, Refresh Timestamp)
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]/60">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg bg-[#0052FF]/10 text-[#0052FF]">
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
          {isConnected && !isWrongNetwork && (
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
          )}

          {isConnected && onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="pop-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[11px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[#0052FF] transition cursor-pointer"
            >
              <RefreshCw size={11} className={isRefreshing ? "animate-spin text-[#0052FF]" : ""} />
              <span>{lastUpdatedSecondsAgo > 0 ? `${lastUpdatedSecondsAgo}s ago` : "Live"}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DEMO DATA WARNING BANNER (When Dev Flag Is Active)
          ───────────────────────────────────────────────────────────── */}
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

      {/* ─────────────────────────────────────────────────────────────
          3. PARTIAL PROTOCOL FAILURE BANNER
          ───────────────────────────────────────────────────────────── */}
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
                  className="px-2 py-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] font-bold text-[11px] hover:border-[#0052FF] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={10} />
                  <span>Retry</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. FOUR REAL OVERVIEW METRIC CHIPS
          ───────────────────────────────────────────────────────────── */}
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
          <p className="text-sm font-mono font-black text-[#0052FF] mt-0.5">
            {positions.length} Positions
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. STATE RENDERING (Not Connected, Wrong Network, Loading, Empty, List)
          ───────────────────────────────────────────────────────────── */}

      {/* A. Not Connected State */}
      {!isConnected ? (
        <div className="p-6 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)]/40 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center mx-auto">
            <Wallet size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-[var(--ink)]">Connect your wallet to see your positions</p>
            <p className="text-xs text-[var(--ink-muted)] max-w-sm mx-auto">
              Connect your wallet on Base mainnet to query live collateral deposits, USDC credit lines, and gauge positions.
            </p>
          </div>
          {onRequestConnect && (
            <button
              type="button"
              onClick={onRequestConnect}
              className="px-4 py-2 rounded-xl bg-[#0052FF] text-white hover:bg-[#0047e0] text-xs font-bold shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Wallet size={14} />
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      ) : isWrongNetwork ? (
        /* B. Wrong Network State */
        <div className="p-6 rounded-xl border border-amber-500/25 bg-amber-500/10 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-[var(--ink)]">Unsupported Network</p>
            <p className="text-xs text-[var(--ink-muted)] max-w-sm mx-auto">
              Please switch your wallet to Base mainnet (Chain ID 8453) to load your on-chain positions.
            </p>
          </div>
          {onSwitchNetwork && (
            <button
              type="button"
              onClick={onSwitchNetwork}
              className="px-4 py-2 rounded-xl bg-[#0052FF] text-white hover:bg-[#0047e0] text-xs font-bold shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Switch to Base</span>
            </button>
          )}
        </div>
      ) : isLoading ? (
        /* C. Skeleton Loading State */
        <div className="space-y-2.5">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] flex items-center justify-between animate-pulse"
            >
              <div className="space-y-2">
                <div className="h-4 w-32 bg-[var(--border-subtle)] rounded" />
                <div className="h-3 w-48 bg-[var(--border-subtle)] rounded" />
              </div>
              <div className="flex gap-2">
                <div className="h-7 w-16 bg-[var(--border-subtle)] rounded-lg" />
                <div className="h-7 w-16 bg-[var(--border-subtle)] rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : !hasPositions ? (
        /* D. Empty State (Zero positions on-chain) */
        <div className="p-6 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)]/40 text-center space-y-2">
          <p className="text-sm font-bold text-[var(--ink)]">You have no open positions yet</p>
          <p className="text-xs text-[var(--ink-muted)] max-w-md mx-auto">
            Pick a market below to supply collateral, borrow USDC, or stake in Aerodrome gauges.
          </p>
        </div>
      ) : (
        /* E. Real On-chain Positions Rows */
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
                      className="text-[var(--ink-muted)] hover:text-[#0052FF] transition inline-flex items-center"
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
                      className="pop-pill px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] font-bold text-[11px] text-[var(--ink)] hover:border-[#0052FF] cursor-pointer"
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
                      className="pop-pill px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)] font-bold text-[11px] text-[var(--ink)] hover:border-[#0052FF] cursor-pointer"
                    >
                      Borrow
                    </button>
                  )}

                  {pos.canRepay && (
                    <button
                      type="button"
                      onClick={() => onOpenAction?.(pos.marketId, "repay")}
                      className="pop-pill px-2.5 py-1 rounded-lg bg-[#0052FF] text-white font-bold text-[11px] shadow-xs cursor-pointer"
                    >
                      Repay
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
