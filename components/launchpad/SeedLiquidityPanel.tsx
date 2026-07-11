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

  const isCreator =
    wallet &&
    token.creator &&
    wallet.address.toLowerCase() === token.creator.toLowerCase();

  const tokenAmount = useMemo(() => {
    if (tokenBalance <= 0) return 0;
    return Math.floor(tokenBalance * (tokenPct / 100));
  }, [tokenBalance, tokenPct]);

  if (!isCreator || tokenBalance <= 0) return null;

  const onSeed = async () => {
    const eth = parseFloat(seedEth);
    if (!Number.isFinite(eth) || eth <= 0) {
      showToast("Enter a valid ETH amount", "");
      return;
    }
    if (tokenAmount < 1) {
      showToast("Not enough tokens — lower % or get a larger balance", "");
      return;
    }
    const ok = await handleSeedLiquidity({
      token: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      tokenAmount: String(tokenAmount),
      seedEth,
      seedDex,
    });
    if (ok) {
      showToast(`Pool seeded — ${token.symbol} is tradable`, "");
      onSeeded?.();
    }
  };

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-4 space-y-3 mb-4">
      <p className="text-sm font-black text-cyan-200 flex items-center gap-2">
        <Droplets size={16} /> Enable in-app trading
      </p>
      <p className="text-[11px] text-cyan-200/70 leading-relaxed">
        Swaps need a WETH pool on Aerodrome or Uniswap V3. Seed once — then anyone can trade
        in-app without visiting an external DEX.
      </p>
      <label className="block">
        <span className="text-[10px] font-bold text-slate-500 uppercase">Pool venue</span>
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
                  ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-200"
                  : "border-white/10 text-slate-500"
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
            <span className="text-[10px] font-bold text-slate-500 uppercase">ETH to add</span>
            {seedUsd != null && (
              <span className="text-[11px] font-bold text-emerald-300 font-mono tabular-nums">
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
            className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none focus:border-cyan-500/40"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
                {SEED_LIQUIDITY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSeedEth(preset)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                      seedEth === preset
                        ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-200"
                        : "border-white/10 text-slate-500"
                    }`}
                  >
                    {preset} ETH
                    {ethUsd > 0 && (
                      <span className="text-slate-500 font-normal ml-1">
                        ({formatUsd(parseFloat(preset) * ethUsd)})
                      </span>
                    )}
                  </button>
                ))}
          </div>
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            Tokens ({formatCompact(tokenAmount)} {token.symbol})
          </span>
          <div className="flex gap-1.5 mt-1">
            {[10, 25, 50, 100].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTokenPct(p)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold border ${
                  tokenPct === p
                    ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-200"
                    : "border-white/10 text-slate-500"
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
        className="w-full py-3 rounded-xl font-black text-sm bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {swapLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Seeding pool…
          </>
        ) : (
          "Seed pool & enable swaps"
        )}
      </button>
    </div>
  );
}
