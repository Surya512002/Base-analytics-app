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
  const estimatedGasUsd = 0.04; // Typical Base L2 gas in USD
  const totalEstimatedUsd = seedUsdNum + estimatedGasUsd;

  const canLaunch =
    isFormValid &&
    (!isStockPaired || acknowledgedRisk) &&
    !isLaunching;

  return (
    <div className="space-y-5">
      {/* Step Header */}
      <div>
        <h2 className="text-lg font-black text-[var(--ink)]">Review &amp; Deploy</h2>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Review token specifications, distribution, and costs before confirming on Base.
        </p>
      </div>

      {/* Main Review Card */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-4">
        {/* Token Identity Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-[var(--border-subtle)]/60">
          <TokenLogo
            symbol={symbol || "TKN"}
            src={imagePreview}
            size={56}
            shape="rounded-xl"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-[var(--ink)]">{name || "Unnamed Token"}</h3>
              <span className="text-xs font-mono font-bold text-[var(--brand-text)]">
                ${symbol || "TKN"}
              </span>
            </div>
            <p className="text-xs text-[var(--ink-muted)] mt-0.5">
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

        {/* Specifications Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="text-[11px] text-[var(--ink-muted)]">Fixed Supply</span>
            <p className="font-mono font-bold text-[var(--ink)]">1,000,000,000 (1B)</p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="text-[11px] text-[var(--ink-muted)]">Starting Price</span>
            <p className="font-mono font-bold text-[var(--ink)]">{formatReadablePrice(startPriceUsd)}</p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="text-[11px] text-[var(--ink-muted)]">Creator Fee Share</span>
            <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              0.25% per swap
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="text-[11px] text-[var(--ink-muted)]">Distribution</span>
            <p className="font-mono font-bold text-[var(--ink)]">
              {creatorPct}% creator · {poolReservePct}% pool
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="text-[11px] text-[var(--ink-muted)]">Initial Pool</span>
            <p className="font-mono font-bold text-[var(--ink)]">
              {autoSeedLiquidity ? `${seedDex.toUpperCase()} (${seedLiquidityEth} ETH)` : "None (manual)"}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="text-[11px] text-[var(--ink-muted)]">Liquidity Lock</span>
            <p className="font-mono font-bold text-[var(--ink)]">
              {liquidityLocked ? `${lockDurationDays} days` : "Unlocked"}
            </p>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="pt-2 border-t border-[var(--border-subtle)]/60 space-y-2 text-xs">
          <div className="flex justify-between text-[var(--ink-muted)]">
            <span>Base Network Deployment Gas</span>
            <span className="font-mono font-bold text-[var(--ink)]">~0.000015 ETH (~$0.04)</span>
          </div>
          <div className="flex justify-between text-[var(--ink-muted)]">
            <span>Vanity Salt Grinding</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">Free ($0.00)</span>
          </div>
          {autoSeedLiquidity && (
            <div className="flex justify-between text-[var(--ink-muted)]">
              <span>Initial LP Seed Deposit</span>
              <span className="font-mono font-bold text-[var(--ink)]">
                {seedLiquidityEth} ETH (~${seedUsdNum.toFixed(2)})
              </span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm text-[var(--ink)] pt-1 border-t border-[var(--border-subtle)]/40">
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
        <div className="p-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs space-y-2.5">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>Required Risk Acknowledgement</span>
          </div>
          <p className="text-[11px] leading-relaxed opacity-95">
            You are creating a memestock paired directly against tokenized equity shares ({selectedStock?.symbol}). Equity markets close on weekends and US holidays.
          </p>
          <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledgedRisk}
              onChange={(e) => setAcknowledgedRisk(e.target.checked)}
              className="w-4 h-4 rounded text-[var(--brand)] accent-[var(--brand)] cursor-pointer"
            />
            <span className="font-bold text-xs text-[var(--ink)]">
              I understand tokenized stock trading hours and volatility risks
            </span>
          </label>
        </div>
      )}

      {/* Validation or Transaction Error Alert */}
      {validationError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {launchError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 space-y-1">
          <div className="flex items-center justify-between font-bold">
            <span>
              {launchError.step === "attribution"
                ? "Attribution transaction failed"
                : "Deployment transaction failed"}
            </span>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 underline cursor-pointer hover:text-red-700"
            >
              <RotateCcw size={12} /> Retry
            </button>
          </div>
          <p className="text-[11px] leading-relaxed">{launchError.message}</p>
        </div>
      )}

      {/* Primary Launch Button */}
      <div>
        {!isConnected ? (
          <button
            type="button"
            onClick={onRequestConnect}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#0052FF] text-white hover:bg-[#0047e0] font-bold text-sm shadow-sm transition active:scale-[0.98] cursor-pointer"
          >
            Connect Wallet to Launch
          </button>
        ) : (
          <button
            type="button"
            disabled={!canLaunch}
            onClick={onLaunch}
            className={`w-full py-3.5 px-5 rounded-2xl font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 ${
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
