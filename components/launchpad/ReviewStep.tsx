"use client";

import React, { useState } from "react";
import {
  Rocket,
  AlertTriangle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import type { LaunchTokenType } from "@/lib/launchpad/types";
import type { BaseStock } from "@/lib/stocks/base-stocks";
import { formatReadablePrice } from "@/lib/launchpad/launch-configs";
import TokenLogo from "@/components/ui/TokenLogo";

interface ReviewStepProps {
  launchType: LaunchTokenType;
  selectedStock?: BaseStock;
  name: string;
  symbol: string;
  imagePreview: string | null;
  creatorPct: number;
  insiderTotalPct?: number;
  vestedTotalPct?: number;
  poolReservePct: number;
  autoSeedLiquidity: boolean;
  seedDex: string;
  seedLiquidityEth: string;
  liquidityLocked: boolean;
  lockDurationDays: number;
  antiSnipeBlocks?: number;
  metadataEditable?: boolean;
  startPriceUsd: string;
  ethUsd: number;
  vanityAddress?: string | null;
  // Wallet / action states
  isConnected: boolean;
  onRequestConnect: () => void;
  isLaunching: boolean;
  launchStateText?: string;
  launchError?: { step: "deploy" | "attribution" | "general"; message: string } | null;
  onLaunch: () => void;
  onRetry: () => void;
  isFormValid: boolean;
  validationError?: string | null;
}

export default function ReviewStep({
  launchType,
  selectedStock,
  name,
  symbol,
  imagePreview,
  creatorPct,
  insiderTotalPct: _insiderTotalPct,
  vestedTotalPct: _vestedTotalPct,
  poolReservePct,
  autoSeedLiquidity,
  seedDex,
  seedLiquidityEth,
  liquidityLocked,
  lockDurationDays,
  antiSnipeBlocks: _antiSnipeBlocks,
  metadataEditable: _metadataEditable,
  startPriceUsd,
  ethUsd,
  vanityAddress: _vanityAddress,
  isConnected,
  onRequestConnect,
  isLaunching,
  launchStateText,
  launchError,
  onLaunch,
  onRetry,
  isFormValid,
  validationError,
}: ReviewStepProps) {
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);
  const isStockPaired = launchType === "memestock";

  // Gas and seed costs
  const seedEthNum = autoSeedLiquidity ? parseFloat(seedLiquidityEth) || 0 : 0;
  const seedUsdNum = seedEthNum * ethUsd;
  const estimatedGasUsd = 0.04;
  const totalEstimatedUsd = seedUsdNum + estimatedGasUsd;

  const canLaunch =
    isFormValid &&
    (!isStockPaired || acknowledgedRisk) &&
    !isLaunching;

  return (
    <div className="space-y-5 max-w-full overflow-hidden">
      {/* Step Header */}
      <div>
        <h2 className="text-[clamp(1.125rem,4vw,1.25rem)] font-black text-[var(--ink)]">
          Review &amp; Deploy
        </h2>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Review token specifications, distribution, and costs before confirming on Base.
        </p>
      </div>

      {/* Main Review Card */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5 space-y-4">
        {/* Token Identity Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-[var(--border-subtle)]/60 min-w-0">
          <TokenLogo
            symbol={symbol || "TKN"}
            src={imagePreview}
            size={56}
            shape="rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-[var(--ink)] truncate">{name || "Unnamed Token"}</h3>
              <span className="text-xs font-mono font-bold text-[var(--brand-text)]">
                ${symbol || "TKN"}
              </span>
            </div>
            <p className="text-xs text-[var(--ink-muted)] mt-0.5 truncate">
              Standard:{" "}
              <strong className="text-[var(--ink)]">
                {launchType === "memestock"
                  ? `Stock-Paired (${selectedStock?.symbol ?? "NVDAc"})`
                  : launchType === "standard"
                    ? "ERC-20 Meme Coin"
                    : "B20 Vanity Token"}
              </strong>
            </p>
          </div>
        </div>

        {/* Specifications Grid: 1 column under 360px, 2 columns on 360px+, 3 columns on desktop */}
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-0.5 min-w-0">
            <span className="text-[11px] text-[var(--ink-muted)]">Fixed Supply</span>
            <p className="font-mono font-bold text-[var(--ink)] truncate">1,000,000,000 (1B)</p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-0.5 min-w-0">
            <span className="text-[11px] text-[var(--ink-muted)]">Starting Price</span>
            <p className="font-mono font-bold text-[var(--ink)] truncate">{formatReadablePrice(startPriceUsd)}</p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-0.5 min-w-0">
            <span className="text-[11px] text-[var(--ink-muted)]">Creator Fee Share</span>
            <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate">
              0.25% per swap
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-0.5 min-w-0">
            <span className="text-[11px] text-[var(--ink-muted)]">Distribution</span>
            <p className="font-mono font-bold text-[var(--ink)] truncate">
              {creatorPct}% creator · {poolReservePct}% pool
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-0.5 min-w-0">
            <span className="text-[11px] text-[var(--ink-muted)]">Initial Pool</span>
            <p className="font-mono font-bold text-[var(--ink)] truncate">
              {autoSeedLiquidity ? `${seedDex.toUpperCase()} (${seedLiquidityEth} ETH)` : "None (manual)"}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-0.5 min-w-0">
            <span className="text-[11px] text-[var(--ink-muted)]">Liquidity Lock</span>
            <p className="font-mono font-bold text-[var(--ink)] truncate">
              {liquidityLocked ? `${lockDurationDays} days` : "Unlocked"}
            </p>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="pt-2 border-t border-[var(--border-subtle)]/60 space-y-2 text-xs">
          <div className="flex flex-wrap justify-between items-center text-[var(--ink-muted)] gap-1">
            <span>Base Network Deployment Gas</span>
            <span className="font-mono font-bold text-[var(--ink)]">~0.000015 ETH (~$0.04)</span>
          </div>
          <div className="flex flex-wrap justify-between items-center text-[var(--ink-muted)] gap-1">
            <span>Vanity Salt Grinding</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">Free ($0.00)</span>
          </div>
          {autoSeedLiquidity && (
            <div className="flex flex-wrap justify-between items-center text-[var(--ink-muted)] gap-1">
              <span>Initial LP Seed Deposit</span>
              <span className="font-mono font-bold text-[var(--ink)]">
                {seedLiquidityEth} ETH (~${seedUsdNum.toFixed(2)})
              </span>
            </div>
          )}
          <div className="flex flex-wrap justify-between items-center font-bold text-sm text-[var(--ink)] pt-1 border-t border-[var(--border-subtle)]/40 gap-1">
            <span>Total Estimated Cost</span>
            <span className="font-mono text-[var(--brand-text)]">
              {seedEthNum > 0 ? `${seedEthNum.toFixed(4)} ETH ` : ""}
              (~${totalEstimatedUsd.toFixed(2)})
            </span>
          </div>
        </div>
      </div>

      {/* Stock-Paired Risk Disclosure with Checkbox Gating */}
      {isStockPaired && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/25 text-xs space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-300">
            <AlertTriangle size={16} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>Required Risk Acknowledgement</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-950 dark:text-amber-100 font-medium break-words">
            You are creating a memestock paired directly against tokenized equity shares ({selectedStock?.symbol}). Equity markets close on weekends and US holidays.
          </p>
          <label className="flex items-start sm:items-center gap-2.5 pt-1 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={acknowledgedRisk}
              onChange={(e) => setAcknowledgedRisk(e.target.checked)}
              className="mt-0.5 sm:mt-0 w-4 h-4 rounded text-[var(--brand)] accent-[var(--brand)] cursor-pointer shrink-0"
              aria-label="Acknowledge tokenized stock risks"
            />
            <span className="font-bold text-xs text-[var(--ink)] leading-snug">
              I understand tokenized stock trading hours and volatility risks
            </span>
          </label>
        </div>
      )}

      {/* Validation or Transaction Error Alert */}
      {validationError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span className="break-words">{validationError}</span>
        </div>
      )}

      {launchError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 space-y-1">
          <div className="flex items-center justify-between font-bold flex-wrap gap-1">
            <span>
              {launchError.step === "attribution"
                ? "Attribution transaction failed"
                : "Deployment transaction failed"}
            </span>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 underline cursor-pointer hover:text-red-700 min-h-[32px]"
            >
              <RotateCcw size={12} /> Retry
            </button>
          </div>
          <p className="text-[11px] leading-relaxed break-words">{launchError.message}</p>
        </div>
      )}

      {/* Primary Launch Button (Full width, min 48px height) */}
      <div className="w-full pt-1">
        {!isConnected ? (
          <button
            type="button"
            onClick={onRequestConnect}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#0052FF] text-white hover:bg-[#0047e0] font-bold text-sm shadow-sm transition active:scale-[0.98] cursor-pointer min-h-[48px] flex items-center justify-center"
          >
            Connect Wallet to Launch
          </button>
        ) : (
          <button
            type="button"
            disabled={!canLaunch}
            onClick={onLaunch}
            className={`w-full py-3.5 px-5 rounded-2xl font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 min-h-[48px] ${
              canLaunch
                ? "bg-[#0052FF] text-white hover:bg-[#0047e0] active:scale-[0.98] cursor-pointer"
                : "bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] cursor-not-allowed opacity-60"
            }`}
          >
            {isLaunching ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{launchStateText || "Deploying on Base…"}</span>
              </>
            ) : !isFormValid ? (
              <span>Complete Required Fields</span>
            ) : isStockPaired && !acknowledgedRisk ? (
              <span>Acknowledge Risk to Continue</span>
            ) : (
              <>
                <Rocket size={16} />
                <span>Launch ${symbol || "TOKEN"} on Base</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
