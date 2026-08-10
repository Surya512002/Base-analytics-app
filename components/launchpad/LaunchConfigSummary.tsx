"use client";

import { computeLaunchEconomics } from "@/lib/launchpad/launch-math";
import { formatPlatformFeeLabel, LAUNCHPAD_PLATFORM_FEE_BPS } from "@/lib/constants/launchpad";
import {
  poolSeedPct,
  type LaunchFormConfig,
} from "@/lib/launchpad/launch-config";

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

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
        <p className="text-[10px] font-bold text-[var(--ink-dim)] uppercase">Fixed supply</p>
        <p className="text-2xl font-black text-[var(--ink)] mt-1">1B</p>
        <p className="text-[10px] text-[var(--ink-dim)] mt-1">B20 on Base</p>
      </div>
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
        <p className="text-[10px] font-bold text-[var(--ink-dim)] uppercase">Swap fee</p>
        <p className="text-lg font-black text-[var(--ink)] mt-1">
          {formatPlatformFeeLabel(LAUNCHPAD_PLATFORM_FEE_BPS)}
        </p>
        <p className="text-[10px] text-[var(--ink-dim)] mt-1">Uniswap + Aerodrome</p>
      </div>
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-4">
        <p className="text-[10px] font-bold text-[var(--ink-dim)] uppercase">Pool + vest</p>
        <p className="text-lg font-black text-[var(--ink-muted)] mt-1">{pool}% pool</p>
        <p className="text-[10px] text-[var(--ink-dim)] mt-1">
          {vested > 0 ? `${vested}% vested lock` : "Locked reserve"}
        </p>
      </div>
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
        <p className="text-[10px] font-bold text-[var(--ink-dim)] uppercase">Start price</p>
        <p className="text-lg font-black text-[var(--ink)] mt-1">{econ.priceUsdLabel}</p>
        <p className="text-[10px] text-[var(--ink-dim)] mt-1">{econ.priceEthLabel} · {config.quoteToken}</p>
      </div>
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
        <p className="text-[10px] font-bold text-[var(--ink-dim)] uppercase">Launch market cap</p>
        <p className="text-lg font-black text-emerald-700 mt-1">{econ.marketCapUsdLabel}</p>
        <p className="text-[10px] text-[var(--ink-dim)] mt-1">{econ.marketCapEthLabel}</p>
      </div>
    </div>
  );
}
