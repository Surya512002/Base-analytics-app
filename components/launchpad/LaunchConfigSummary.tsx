"use client";

import React, { useMemo } from "react";
import { computeLaunchEconomics } from "@/lib/launchpad/launch-math";
import { formatPlatformFeeLabel, LAUNCHPAD_PLATFORM_FEE_BPS } from "@/lib/constants/launchpad";
import {
  poolSeedPct,
  type LaunchFormConfig,
} from "@/lib/launchpad/launch-config";
import { ShieldCheck, ShieldAlert, Clock, Bot, Sparkles, CheckCircle2 } from "lucide-react";

export default function LaunchConfigSummary({
  config,
  ethUsd,
}: {
  config: LaunchFormConfig;
  ethUsd: number;
}) {
  const econ = computeLaunchEconomics(config.startPriceUsd, ethUsd);
  const pool = poolSeedPct({
    creatorPct: config.creatorPct,
    insiderAllocations: config.insiderAllocations,
    vestedAllocations: config.vestedAllocations,
  });
  const vested = (config.vestedAllocations ?? []).reduce((s, a) => s + (a.pct || 0), 0);
  const antiSnipeBlocks = config.antiSnipeBlocks ?? 8;

  // Compute Launch Readiness Score (0-100)
  const readiness = useMemo(() => {
    let score = 0;
    const reasons: string[] = [];

    // 1. Liquidity Pool allocation (0-30 pts)
    if (pool >= 80) {
      score += 30;
      reasons.push("Excellent liquidity: 80%+ reserved for open market DEX trading");
    } else if (pool >= 60) {
      score += 22;
      reasons.push("Healthy liquidity: 60%+ pool allocation");
    } else {
      score += 12;
      reasons.push("Low initial pool allocation (< 60%)");
    }

    // 2. Vesting & Insider Protection (0-25 pts)
    if (vested > 0 || config.creatorPct <= 5) {
      score += 25;
      reasons.push("Fair distribution: Team allocations locked with vesting schedules");
    } else if (config.creatorPct <= 10) {
      score += 18;
      reasons.push("Modest team allocation (≤ 10%)");
    } else {
      score += 8;
      reasons.push("Large unlocked creator allocation (> 10%) without vesting");
    }

    // 3. Anti-Snipe Protection (0-25 pts)
    if (antiSnipeBlocks >= 5) {
      score += 25;
      reasons.push(`Anti-snipe dampening active: ${antiSnipeBlocks} blocks prevent MEV bundle extraction`);
    } else if (antiSnipeBlocks > 0) {
      score += 15;
      reasons.push(`Minimal anti-snipe protection (${antiSnipeBlocks} blocks)`);
    } else {
      score += 5;
      reasons.push("No anti-snipe cooldown: vulnerable to block-0 MEV bots");
    }

    // 4. Sizing (0-20 pts)
    score += 20;
    reasons.push("Realistic starting valuation sized for Base liquidity depth");

    return {
      score: Math.min(100, score),
      tier: score >= 85 ? "Optimal" : score >= 70 ? "Ready" : "Needs Review",
      reasons,
    };
  }, [pool, vested, config.creatorPct, antiSnipeBlocks]);

  return (
    <div className="space-y-4">
      {/* 5-Column Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
          <p className="text-[10px] font-bold text-[var(--ink-dim)] uppercase tracking-wider">Fixed supply</p>
          <p className="text-2xl font-black text-[var(--ink)] mt-1 font-mono">1B</p>
          <p className="text-[10px] text-[var(--ink-muted)] mt-1">B20 on Base</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
          <p className="text-[10px] font-bold text-[var(--ink-dim)] uppercase tracking-wider">Swap fee</p>
          <p className="text-lg font-black text-[var(--ink)] mt-1 font-mono">
            {formatPlatformFeeLabel(LAUNCHPAD_PLATFORM_FEE_BPS)}
          </p>
          <p className="text-[10px] text-[var(--ink-muted)] mt-1">Uniswap + Aerodrome</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
          <p className="text-[10px] font-bold text-[var(--ink-dim)] uppercase tracking-wider">Pool + vest</p>
          <p className="text-lg font-black text-[var(--ink)] mt-1 font-mono">{pool}% pool</p>
          <p className="text-[10px] text-[var(--ink-muted)] mt-1">
            {vested > 0 ? `${vested}% vested lock` : "Locked reserve"}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
          <p className="text-[10px] font-bold text-[var(--ink-dim)] uppercase tracking-wider">Start price</p>
          <p className="text-lg font-black text-[var(--ink)] mt-1 font-mono">{econ.priceUsdLabel}</p>
          <p className="text-[10px] text-[var(--ink-muted)] mt-1">{econ.priceEthLabel} · {config.quoteToken}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
          <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Launch market cap</p>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{econ.marketCapUsdLabel}</p>
          <p className="text-[10px] text-[var(--ink-muted)] mt-1">{econ.marketCapEthLabel}</p>
        </div>
      </div>

      {/* Launch Readiness Score & Sniper Impact Card */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-5 space-y-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-[var(--ink)]">Launch Readiness Score</span>
                <span className="font-mono font-bold px-2 py-0.5 rounded-full text-[11px] bg-[#0052FF] text-white">
                  {readiness.score}/100 ({readiness.tier})
                </span>
              </div>
              <p className="text-[11px] text-[var(--ink-muted)]">
                Evaluates allocations, vesting locks, liquidity health, and anti-snipe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-[var(--ink-muted)]">Anti-Snipe:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Bot size={13} /> {antiSnipeBlocks} Blocks Cooldown
            </span>
          </div>
        </div>

        {/* Readiness Checklist */}
        <div className="grid sm:grid-cols-2 gap-2 text-[11px]">
          {readiness.reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5 p-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
              <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-[var(--ink)]">{r}</span>
            </div>
          ))}
        </div>

        {/* Vesting Timeline & Sniper Impact Preview */}
        <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--ink)]">
            <span className="flex items-center gap-1">
              <Clock size={13} className="text-[#0052FF]" />
              <span>Vesting Timeline &amp; Anti-Snipe Guard</span>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400">Protected Opening</span>
          </div>

          <div className="h-2 w-full rounded-full bg-[var(--surface-3)] overflow-hidden flex">
            <div style={{ width: `${Math.min(100, pool)}%` }} className="h-full bg-blue-500" title={`Pool: ${pool}%`} />
            {vested > 0 && (
              <div style={{ width: `${Math.min(100 - pool, vested)}%` }} className="h-full bg-purple-500" title={`Vested: ${vested}%`} />
            )}
          </div>

          <div className="flex justify-between text-[10px] text-[var(--ink-dim)]">
            <span>Block 0: Pool opens with {pool}% supply locked</span>
            <span>Block {antiSnipeBlocks}: Cooldown ends, full trading enabled</span>
            <span>Month 6+: Linear vesting unlock</span>
          </div>
        </div>
      </div>
    </div>
  );
}
