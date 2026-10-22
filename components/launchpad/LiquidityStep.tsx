"use client";

import React, { useState, useMemo } from "react";
import {
  Lock,
  Check,
  Info,
  Copy,
  AlertTriangle,
  Zap,
  ShieldCheck,
} from "lucide-react";
import {
  LOCK_DURATION_OPTIONS,
  VENUE_OPTIONS,
  type LaunchVenueId,
  MAX_ANTI_SNIPE_BLOCKS,
} from "@/lib/launchpad/launch-configs";
import {
  SEED_LIQUIDITY_PRESETS,
  computeLiquiditySeedAmounts,
  seedEthUsdValue,
} from "@/lib/launchpad/seed-liquidity";
import { OPENLAUNCH_LOCKER_BASE } from "@/lib/stocks/base-stocks";
import { copyToClipboard } from "@/lib/utils/clipboard";

interface LiquidityStepProps {
  autoSeedLiquidity: boolean;
  onAutoSeedLiquidityChange: (v: boolean) => void;
  seedDex: LaunchVenueId;
  onSeedDexChange: (v: LaunchVenueId) => void;
  seedLiquidityEth: string;
  onSeedLiquidityEthChange: (v: string) => void;
  liquidityLocked: boolean;
  onLiquidityLockedChange: (v: boolean) => void;
  lockDurationDays: number;
  onLockDurationDaysChange: (v: number) => void;
  antiSnipeBlocks: number;
  onAntiSnipeBlocksChange: (v: number) => void;
  metadataEditable: boolean;
  onMetadataEditableChange: (v: boolean) => void;
  ethUsd: number;
  startPriceUsd: string;
}

export default function LiquidityStep({
  autoSeedLiquidity,
  onAutoSeedLiquidityChange,
  seedDex,
  onSeedDexChange,
  seedLiquidityEth,
  onSeedLiquidityEthChange,
  liquidityLocked,
  onLiquidityLockedChange,
  lockDurationDays,
  onLockDurationDaysChange,
  antiSnipeBlocks,
  onAntiSnipeBlocksChange,
  metadataEditable,
  onMetadataEditableChange,
  ethUsd,
  startPriceUsd,
}: LiquidityStepProps) {
  const [showLockerInfo, setShowLockerInfo] = useState(false);
  const [copiedLocker, setCopiedLocker] = useState(false);

  // Computed seed USD & token amount
  const seedUsd = useMemo(
    () => seedEthUsdValue(seedLiquidityEth, ethUsd),
    [seedLiquidityEth, ethUsd]
  );

  const seedAmounts = useMemo(() => {
    if (!autoSeedLiquidity) return null;
    return computeLiquiditySeedAmounts({
      seedEth: seedLiquidityEth,
      startPriceUsd,
      ethUsd,
      decimals: 18,
    });
  }, [autoSeedLiquidity, seedLiquidityEth, startPriceUsd, ethUsd]);

  // Is seed amount very low (< $5)
  const isLowSeed = seedUsd !== null && seedUsd < 5;

  // Estimated price impact for $10 buy on this pool
  const priceImpact10Dollar = useMemo(() => {
    if (!seedUsd || seedUsd <= 0) return "100%";
    const impact = (10 / (seedUsd * 2)) * 100;
    return impact > 50 ? ">50%" : `${impact.toFixed(1)}%`;
  }, [seedUsd]);

  const handleCopyLocker = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(OPENLAUNCH_LOCKER_BASE);
    if (ok) {
      setCopiedLocker(true);
      setTimeout(() => setCopiedLocker(false), 2000);
    }
  };

  return (
    <div className="space-y-5">
      {/* Step Header */}
      <div>
        <h2 className="text-lg font-black text-[var(--ink)]">Liquidity &amp; Protection</h2>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Configure initial decentralized exchange pool, smart contract locker, and bot protection.
        </p>
      </div>

      {/* 1. Auto-Seed Initial Pool Toggle */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)]">
              <Zap size={16} />
            </span>
            <div>
              <h3 className="text-xs font-bold text-[var(--ink)]">Auto-Seed Initial Pool</h3>
              <p className="text-[11px] text-[var(--ink-muted)]">
                Create the trading pair immediately upon token deployment
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoSeedLiquidity}
              onChange={(e) => onAutoSeedLiquidityChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[var(--surface-2)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand)] border border-[var(--border-subtle)]"></div>
          </label>
        </div>

        {!autoSeedLiquidity ? (
          <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--ink-muted)]">
            No pool will be created. You can add liquidity after launch.
          </div>
        ) : (
          <div className="space-y-4 pt-2 border-t border-[var(--border-subtle)]/60">
            {/* DEX Venue selection */}
            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-2">
                DEX Trading Venue
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {VENUE_OPTIONS.map((venue) => {
                  const isSelected = seedDex === venue.id;
                  return (
                    <button
                      key={venue.id}
                      type="button"
                      onClick={() => onSeedDexChange(venue.id)}
                      className={`pop-pill p-3 rounded-xl border text-left transition relative cursor-pointer ${
                        isSelected
                          ? "border-[var(--brand)] bg-[var(--surface-2)] shadow-xs ring-1 ring-[var(--brand)]"
                          : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:border-[var(--ink-dim)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[var(--brand)] text-white flex items-center justify-center">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                      <p className="text-xs font-black text-[var(--ink)]">{venue.name}</p>
                      <p className="text-[11px] text-[var(--ink-muted)] mt-1 leading-snug">
                        {venue.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ETH Amount & Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-[var(--ink)]">Seed Liquidity (ETH)</label>
                {seedUsd !== null && (
                  <span className="font-mono text-[var(--ink-muted)]">
                    ≈ ${seedUsd.toFixed(2)} USD
                  </span>
                )}
              </div>

              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-[var(--ink-muted)]">
                    ETH
                  </span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.00005"
                    value={seedLiquidityEth}
                    onChange={(e) => onSeedLiquidityEthChange(e.target.value)}
                    className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-sm font-mono font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--brand-text)]"
                  />
                </div>
              </div>

              {/* Preset Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-[var(--ink-muted)] mr-1">Presets:</span>
                {SEED_LIQUIDITY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onSeedLiquidityEthChange(preset)}
                    className={`pop-pill px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                      seedLiquidityEth === preset
                        ? "bg-[var(--brand)] text-white font-bold"
                        : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    {preset} ETH
                  </button>
                ))}
              </div>

              {/* Low Liquidity Non-blocking Info Hint */}
              {isLowSeed && (
                <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs space-y-1 mt-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
                    <span>Low initial liquidity hint</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-95">
                    Low liquidity means larger price swings for early traders. A $10 swap has an estimated price impact of ~{priceImpact10Dollar}.
                  </p>
                </div>
              )}

              {/* Tokens Minted for Pool Summary */}
              {seedAmounts && (
                <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--ink-muted)] mt-2">
                  <span>Tokens allocated to pool:</span>
                  <span className="font-mono font-bold text-[var(--ink)]">
                    {seedAmounts.tokenHuman.toLocaleString()} tokens
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. OpenLaunch Liquidity Lock & Duration */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Lock size={16} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-[var(--ink)]">OpenLaunch Liquidity Locker</h3>
                <button
                  type="button"
                  onClick={() => setShowLockerInfo((p) => !p)}
                  className="text-[var(--ink-muted)] hover:text-[var(--brand-text)]"
                  title="Locker details"
                >
                  <Info size={13} />
                </button>
              </div>
              <p className="text-[11px] text-[var(--ink-muted)]">
                Locks initial pool LP tokens in smart contract
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={liquidityLocked}
              onChange={(e) => onLiquidityLockedChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[var(--surface-2)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand)] border border-[var(--border-subtle)]"></div>
          </label>
        </div>

        {/* Info Popover for Locker Contract */}
        {showLockerInfo && (
          <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs space-y-1.5 animate-meridian-fade">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--ink)]">Verified OpenLaunch Locker</span>
              <button
                type="button"
                onClick={() => setShowLockerInfo(false)}
                className="text-xs text-[var(--ink-muted)]"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-[var(--ink-muted)]">
              LP tokens are transferred to the onchain contract and cannot be withdrawn before the lock expiration.
            </p>
            <div className="flex items-center justify-between p-1.5 rounded bg-[var(--surface)] border border-[var(--border-subtle)] font-mono text-[10px]">
              <span>{OPENLAUNCH_LOCKER_BASE}</span>
              <button
                type="button"
                onClick={handleCopyLocker}
                className="p-1 rounded text-[var(--brand-text)]"
                title="Copy locker address"
              >
                <Copy size={12} />
              </button>
            </div>
            {copiedLocker && <p className="text-[10px] text-emerald-600 font-bold">Locker address copied!</p>}
          </div>
        )}

        {/* Lock Duration Chips */}
        {liquidityLocked && (
          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]/60">
            <label className="block text-xs font-bold text-[var(--ink)]">Lock Duration</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LOCK_DURATION_OPTIONS.map((opt) => {
                const isSelected = lockDurationDays === opt.days;
                return (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => onLockDurationDaysChange(opt.days)}
                    className={`pop-pill py-2 px-3 rounded-xl border text-center text-xs font-bold transition relative cursor-pointer ${
                      isSelected
                        ? "border-[var(--brand-text)] bg-[var(--brand-soft)] text-[var(--brand-text)] ring-1 ring-[var(--brand)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {isSelected && (
                      <span className="inline-block mr-1">
                        <Check size={11} className="inline" />
                      </span>
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. Anti-Snipe Block Window Slider */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[var(--brand-text)]" />
            <h3 className="text-xs font-bold text-[var(--ink)]">Anti-Snipe Block Window</h3>
          </div>
          <span className="font-mono font-bold text-xs text-[var(--brand-text)]">
            {antiSnipeBlocks === 0 ? "Disabled (0 blocks)" : `${antiSnipeBlocks} blocks (~${antiSnipeBlocks * 2}s)`}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={MAX_ANTI_SNIPE_BLOCKS}
          step={1}
          value={antiSnipeBlocks}
          onChange={(e) => onAntiSnipeBlocksChange(parseInt(e.target.value, 10))}
          className="w-full accent-[var(--brand)] cursor-pointer"
        />

        <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">
          {antiSnipeBlocks === 0
            ? "Trading opens immediately with zero block delay. Front-running bot protection is off."
            : `Protects against MEV sandwich bots by rate-limiting max buy size during the first ${antiSnipeBlocks} blocks after deployment.`}
        </p>
      </div>

      {/* 4. Metadata Editable Option */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={metadataEditable}
            onChange={(e) => onMetadataEditableChange(e.target.checked)}
            className="mt-1 w-4 h-4 rounded text-[var(--brand)] accent-[var(--brand)] cursor-pointer"
          />
          <div>
            <span className="text-xs font-bold text-[var(--ink)]">
              Allow token metadata edits after launch
            </span>
            <p className="text-[11px] text-[var(--ink-muted)] mt-0.5 leading-relaxed">
              Enables you to update the logo, website, and description later. Note: this grants an admin role to your creator wallet in the token factory registry.
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}
