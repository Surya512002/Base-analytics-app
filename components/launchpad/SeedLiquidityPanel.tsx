"use client";

import { useEffect, useMemo, useState } from "react";
import { Droplets, Loader2 } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { WalletAppState } from "@/hooks/useWalletApp";
import {
  DEFAULT_SEED_LIQUIDITY_ETH,
  MIN_SEED_LIQUIDITY_ETH,
  SEED_LIQUIDITY_PRESETS,
  seedEthUsdValue,
  type SeedDex,
} from "@/lib/launchpad/seed-liquidity";
import { formatCompact, formatUsd } from "@/lib/launchpad/format";

export default function SeedLiquidityPanel({
  app,
  token,
  tokenBalance,
  onSeeded,
}: {
  app: WalletAppState;
  token: LaunchedToken;
  tokenBalance: number;
  onSeeded?: () => void;
}) {
  const { wallet, showToast, handleSeedLiquidity, swapLoading } = app;
  const [seedEth, setSeedEth] = useState(DEFAULT_SEED_LIQUIDITY_ETH);
  const [seedDex, setSeedDex] = useState<SeedDex>("aerodrome");
  const [tokenPct, setTokenPct] = useState(25);
  const [ethUsd, setEthUsd] = useState(2500);

  useEffect(() => {
    let alive = true;
    void fetch("/api/launchpad/eth-price", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ethUsd?: number }) => {
        if (alive && d.ethUsd && d.ethUsd > 0) setEthUsd(d.ethUsd);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const seedUsd = useMemo(() => seedEthUsdValue(seedEth, ethUsd), [seedEth, ethUsd]);

  const tokenAmountHuman = useMemo(() => {
    if (tokenBalance <= 0) return 0;
    return tokenBalance * (tokenPct / 100);
  }, [tokenBalance, tokenPct]);

  const tokenAmount = useMemo(() => {
    if (tokenAmountHuman <= 0) return "0";
    if (tokenAmountHuman >= 1) return String(Math.floor(tokenAmountHuman));
    return String(tokenAmountHuman);
  }, [tokenAmountHuman]);

  const isCreator =
    wallet &&
    token.creator &&
    wallet.address.toLowerCase() === token.creator.toLowerCase();

  if (!isCreator || !wallet || tokenBalance <= 0) return null;

  const onSeed = async () => {
    const eth = parseFloat(seedEth);
    if (!Number.isFinite(eth) || eth <= 0) {
      showToast("Enter a valid ETH amount", "");
      return;
    }
    if (parseFloat(tokenAmount) <= 0) {
      showToast("Not enough tokens — lower % or get a larger balance", "");
      return;
    }
    const ok = await handleSeedLiquidity({
      token: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      tokenAmount,
      seedEth,
      seedDex,
    });
    if (ok) {
      showToast(`${token.symbol} pool seeded — you can swap in-app now`, "");
      onSeeded?.();
    }
  };

  const headline = "Enable in-app trading";
  const blurb =
    "Swaps need a WETH pool on Aerodrome or Uniswap V3. Seed once — then anyone can trade in-app.";

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-4 space-y-3 mb-4">
      <p className="text-sm font-black text-[var(--ink)] flex items-center gap-2">
        <Droplets size={16} /> {headline}
      </p>
      <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed">{blurb}</p>
      <label className="block">
        <span className="text-[10px] font-bold text-[var(--ink-dim)] uppercase">Pool venue</span>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(
            [
              ["aerodrome", "Aerodrome"],
              ["uniswap", "Uniswap V3"],
              ["both", "Both (50/50)"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSeedDex(id)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                seedDex === id
                  ? "border-[var(--border-focus)] bg-[var(--bg-hover)] text-[var(--ink)]"
                  : "border-[var(--border-subtle)] text-[var(--ink-dim)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-[var(--ink-dim)] uppercase">ETH to add</span>
            {seedUsd != null && (
              <span className="text-[11px] font-bold text-emerald-700 font-mono tabular-nums">
                ≈ {formatUsd(seedUsd)}
              </span>
            )}
          </div>
          <input
            type="number"
            min={MIN_SEED_LIQUIDITY_ETH}
            step="0.00001"
            value={seedEth}
            onChange={(e) => setSeedEth(e.target.value)}
            className="mt-1 w-full input-ink rounded-xl px-3 py-2.5 text-sm font-mono"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {SEED_LIQUIDITY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSeedEth(preset)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                  seedEth === preset
                    ? "border-[var(--border-focus)] bg-[var(--bg-hover)] text-[var(--ink)]"
                    : "border-[var(--border-subtle)] text-[var(--ink-dim)]"
                }`}
              >
                {preset} ETH
                {ethUsd > 0 && (
                  <span className="text-[var(--ink-dim)] font-normal ml-1">
                    ({formatUsd(parseFloat(preset) * ethUsd)})
                  </span>
                )}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-[var(--ink-dim)] uppercase">
            Your tokens ({formatCompact(tokenAmountHuman)} {token.symbol})
          </span>
          <div className="flex gap-1.5 mt-1">
            {[10, 25, 50, 100].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTokenPct(p)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold border ${
                  tokenPct === p
                    ? "border-[var(--border-focus)] bg-[var(--bg-hover)] text-[var(--ink)]"
                    : "border-[var(--border-subtle)] text-[var(--ink-dim)]"
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        </label>
      </div>
      <button
        type="button"
        disabled={swapLoading}
        onClick={() => void onSeed()}
        className="btn-primary w-full py-3 rounded-xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {swapLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Adding liquidity…
          </>
        ) : (
          "Add liquidity & enable swaps"
        )}
      </button>
    </div>
  );
}
