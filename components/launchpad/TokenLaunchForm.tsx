"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";
import { parseUnits } from "viem";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { computeLaunchSalt, mergeMintAllocations, predictB20Address } from "@/lib/b20/encode";
import { uploadLaunchpadImage } from "@/lib/api/launchpad-client";
import {
  prepareTokenImage,
  revokePreviewUrl,
} from "@/lib/launchpad/image-upload";
import type { LaunchedToken } from "@/lib/launchpad/types";
import {
  FIXED_LAUNCH_SUPPLY,
  poolSeedPct,
  totalAllocatedPct,
  type InsiderAllocation,
  type QuoteToken,
  type VestedAllocation,
} from "@/lib/launchpad/launch-config";
import { applyLaunchPreset, getLaunchPreset, type LaunchPresetId } from "@/lib/launchpad/launch-presets";
import {
  computeLiquiditySeedAmounts,
  DEFAULT_SEED_LIQUIDITY_ETH,
  MIN_SEED_LIQUIDITY_ETH,
  SEED_LIQUIDITY_PRESETS,
  seedEthUsdValue,
  type SeedDex,
} from "@/lib/launchpad/seed-liquidity";
import { formatUsd } from "@/lib/launchpad/format";
import LaunchAdvantageStrip from "@/components/launchpad/LaunchAdvantageStrip";
import RevenueSharingLaunchBanner from "@/components/launchpad/RevenueSharingLaunchBanner";
import { BUILDER_CODE } from "@/lib/constants/env";
import { grindVanityAddress } from "@/lib/launchpad/vanity-salt";
import LaunchConfigSummary from "@/components/launchpad/LaunchConfigSummary";
import VanityAddressCard from "@/components/launchpad/VanityAddressCard";
import LaunchOptionsPanel from "@/components/launchpad/LaunchOptionsPanel";
import TokenLaunchPreview from "@/components/launchpad/TokenLaunchPreview";
import LaunchSuccessPanel from "@/components/launchpad/LaunchSuccessPanel";

const DEFAULT_START_PRICE = "0.000003918";

function formatCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function TokenLaunchForm({
  app,
  onLaunched,
  onTrade,
  onExplore,
}: {
  app: WalletAppState;
  onLaunched?: () => void;
  onTrade?: (token: LaunchedToken) => void;
  onExplore?: () => void;
}) {
  const { wallet, launchLoading, b20Activated, handleLaunchB20, showToast } = app;
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [discord, setDiscord] = useState("");
  const [quoteToken, setQuoteToken] = useState<QuoteToken>("ETH");
  const [startPriceUsd, setStartPriceUsd] = useState(DEFAULT_START_PRICE);
  const [metadataEditable, setMetadataEditable] = useState(false);
  const [creatorPct, setCreatorPct] = useState(10);
  const [insiders, setInsiders] = useState<InsiderAllocation[]>([]);
  const [vested, setVested] = useState<VestedAllocation[]>([]);
  const [activePreset, setActivePreset] = useState<LaunchPresetId | null>(null);
  const [antiSnipeBlocks, setAntiSnipeBlocks] = useState(8);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [vanitySalt, setVanitySalt] = useState<`0x${string}` | null>(null);
  const [vanityAddress, setVanityAddress] = useState<string | null>(null);
  const [vanityAttempts, setVanityAttempts] = useState(0);
  const [grinding, setGrinding] = useState(false);
  const [ethUsd, setEthUsd] = useState(2500);
  const [launchedToken, setLaunchedToken] = useState<LaunchedToken | null>(null);
  const [seedLiquidityEth, setSeedLiquidityEth] = useState(DEFAULT_SEED_LIQUIDITY_ETH);
  const [autoSeedLiquidity, setAutoSeedLiquidity] = useState(true);
  const [seedDex, setSeedDex] = useState<SeedDex>("aerodrome");

  const decimals = 18;
  const poolPct = poolSeedPct({ creatorPct, insiderAllocations: insiders, vestedAllocations: vested });
  const allocated = totalAllocatedPct({
    creatorPct,
    insiderAllocations: insiders,
    vestedAllocations: vested,
  });
  const vestedPct = vested.reduce((s, v) => s + (v.pct || 0), 0);

  const seedPreview = useMemo(() => {
    if (!autoSeedLiquidity) return null;
    return computeLiquiditySeedAmounts({
      seedEth: seedLiquidityEth,
      startPriceUsd,
      ethUsd,
      decimals: 18,
    });
  }, [autoSeedLiquidity, seedLiquidityEth, startPriceUsd, ethUsd]);

  const seedUsd = useMemo(
    () => seedEthUsdValue(seedLiquidityEth, ethUsd),
    [seedLiquidityEth, ethUsd]
  );

  const applyPreset = (id: LaunchPresetId) => {
    const preset = getLaunchPreset(id);
    if (!preset) return;
    const applied = applyLaunchPreset(preset);
    setActivePreset(id);
    setCreatorPct(applied.creatorPct);
    setInsiders(applied.insiders);
    setVested(applied.vested);
  };

  const formConfig = useMemo(
    () => ({
      name,
      symbol,
      description,
      website,
      twitter,
      telegram,
      discord,
      quoteToken,
      startPriceUsd,
      metadataEditable,
      creatorPct,
      insiderAllocations: insiders,
      vestedAllocations: vested,
      vanitySalt,
      vanityAttempts,
    }),
    [
      name,
      symbol,
      description,
      website,
      twitter,
      telegram,
      discord,
      quoteToken,
      startPriceUsd,
      metadataEditable,
      creatorPct,
      insiders,
      vested,
      vanitySalt,
      vanityAttempts,
    ]
  );

  const runVanityGrind = useCallback(async () => {
    if (!wallet) return;
    setGrinding(true);
    try {
      const result = await grindVanityAddress(wallet.address as `0x${string}`, {
        onProgress: setVanityAttempts,
        maxAttempts: 25_000,
      });
      if (result) {
        setVanitySalt(result.salt);
        setVanityAddress(result.address);
        setVanityAttempts(result.attempts);
      } else {
        const fallback = computeLaunchSalt(
          name.trim() || "token",
          symbol.trim() || "TKN",
          wallet.address,
          String(Date.now())
        );
        setVanitySalt(fallback);
        const addr = await predictB20Address(wallet.address as `0x${string}`, fallback);
        setVanityAddress(addr);
        showToast("Vanity grind timed out — using standard salt", "");
      }
    } finally {
      setGrinding(false);
    }
  }, [wallet, name, symbol, showToast]);

  useEffect(() => {
    void fetch("/api/launchpad/eth-price")
      .then((r) => r.json())
      .then((d: { ethUsd?: number }) => setEthUsd(d.ethUsd ?? 2500))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!wallet) return;
    const t = setTimeout(() => void runVanityGrind(), 400);
    return () => clearTimeout(t);
  }, [wallet, runVanityGrind]);

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    try {
      const prepared = await prepareTokenImage(file);
      revokePreviewUrl(imagePreview);
      setImagePreview(prepared.previewUrl);
      setImageBlob(prepared.blob);
      setImageUrl(undefined);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Invalid image", "");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet || !vanitySalt) return;
    if (b20Activated === false) {
      showToast("B20 is not activated on Base mainnet yet", "");
      return;
    }
    if (b20Activated !== true) {
      showToast("Checking B20 status — try again in a moment", "");
      return;
    }
    if (allocated > 100) {
      showToast("Allocations cannot exceed 100% of supply", "");
      return;
    }

    const supplyHuman = parseFloat(FIXED_LAUNCH_SUPPLY);
    const mints: { to: `0x${string}`; amount: bigint }[] = [];

    if (creatorPct > 0) {
      const amt = BigInt(Math.floor((supplyHuman * creatorPct) / 100));
      if (amt > BigInt(0)) {
        mints.push({
          to: wallet.address as `0x${string}`,
          amount: parseUnits(String(amt), decimals),
        });
      }
    }

    for (const ins of insiders) {
      const addr = ins.address.trim();
      if (!addr.startsWith("0x") || addr.length !== 42) continue;
      if (ins.pct <= 0) continue;
      const tokens = Math.floor((supplyHuman * ins.pct) / 100);
      if (tokens <= 0) continue;
      mints.push({
        to: addr as `0x${string}`,
        amount: parseUnits(String(tokens), decimals),
      });
    }

    if (autoSeedLiquidity && seedLiquidityEth) {
      const seedEth = parseFloat(seedLiquidityEth);
      const minSeed = parseFloat(MIN_SEED_LIQUIDITY_ETH);
      if (!Number.isFinite(seedEth) || seedEth < minSeed) {
        showToast(`Minimum liquidity seed is ${MIN_SEED_LIQUIDITY_ETH} ETH`, "");
        return;
      }
      const seed = computeLiquiditySeedAmounts({
        seedEth: seedLiquidityEth,
        startPriceUsd,
        ethUsd,
        decimals,
      });
      if (!seed || seed.tokenWei <= BigInt(0)) {
        showToast("Increase seed ETH or lower start price — not enough tokens for the pool", "");
        return;
      }
      mints.push({
        to: wallet.address as `0x${string}`,
        amount: seed.tokenWei,
      });
    }

    const mergedMints = mergeMintAllocations(mints);
    if (mergedMints.length === 0) {
      showToast("Add at least one allocation or enable liquidity seeding", "");
      return;
    }

    let finalImageUrl = imageUrl;
    if (imageBlob && !finalImageUrl) {
      setImageUploading(true);
      try {
        finalImageUrl = (await uploadLaunchpadImage(imageBlob)) ?? undefined;
        if (!finalImageUrl) {
          showToast("Image upload failed", "");
          return;
        }
        setImageUrl(finalImageUrl);
      } finally {
        setImageUploading(false);
      }
    }

    const vestingSchedule = vested
      .filter((v) => v.address.trim().startsWith("0x") && v.pct > 0)
      .map((v) => ({
        address: v.address.trim(),
        pct: v.pct,
        cliffMonths: v.cliffMonths,
        vestMonths: v.vestMonths,
      }));

    const result = await handleLaunchB20({
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      decimals,
      supplyCap: FIXED_LAUNCH_SUPPLY,
      salt: vanitySalt,
      predictedAddress: vanityAddress ?? undefined,
      imageUrl: finalImageUrl,
      description: description.trim() || undefined,
      website: website.trim() || undefined,
      twitter: twitter.trim() || undefined,
      telegram: telegram.trim() || undefined,
      discord: discord.trim() || undefined,
      metadataEditable,
      mints: mergedMints,
      poolSeedPct: poolPct,
      quoteToken,
      startPriceUsd,
      launchPreset: activePreset ?? undefined,
      vestingSchedule: vestingSchedule.length > 0 ? vestingSchedule : undefined,
      antiSnipeBlocks,
      seedLiquidityEth: autoSeedLiquidity ? seedLiquidityEth : undefined,
      autoSeedLiquidity,
      seedDex: autoSeedLiquidity ? seedDex : undefined,
      ethUsd,
    });

    if (result.ok && result.address) {
      setLaunchedToken({
        address: result.address,
        name: result.name ?? name.trim(),
        symbol: result.symbol ?? symbol.trim().toUpperCase(),
        decimals,
        creator: wallet.address,
        txHash: result.txHash ?? "",
        imageUrl: result.imageUrl ?? finalImageUrl,
        description: description.trim() || undefined,
        website: website.trim() || undefined,
        twitter: twitter.trim() || undefined,
        telegram: telegram.trim() || undefined,
        discord: discord.trim() || undefined,
        createdAt: Date.now(),
        supplyCap: FIXED_LAUNCH_SUPPLY,
        launchPreset: activePreset ?? undefined,
        vestingSchedule: vestingSchedule.length > 0 ? vestingSchedule : undefined,
        antiSnipeBlocks,
        startPriceUsd,
      });
      onLaunched?.();
    }
  };

  if (launchedToken) {
    return (
      <LaunchSuccessPanel
        token={launchedToken}
        onTrade={() => onTrade?.(launchedToken)}
        onExplore={() => onExplore?.()}
        onCopied={() => showToast("Contract address copied", "")}
      />
    );
  }

  const creatorTokens = formatCompact((parseFloat(FIXED_LAUNCH_SUPPLY) * creatorPct) / 100);

  return (
    <div className="space-y-6">
      <RevenueSharingLaunchBanner />
      <LaunchAdvantageStrip />

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--ink-muted)] mb-1">
          Create a token
        </p>
        <h2 className="text-2xl sm:text-3xl font-black text-white max-w-3xl">
          Launch on Base with more control, lower fees, and dual-DEX trading
        </h2>
        <p className="text-sm text-slate-400 mt-2 max-w-3xl">
          Fixed 1B B20 supply · vanity 0xB200… addresses · liquid + truly locked vesting ·
          Uniswap + Aerodrome auto-routing · earn points on every launch and swap.
        </p>
      </div>

      {b20Activated === null && (
        <div className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-slate-400">
          Checking B20 activation on Base…
        </div>
      )}
      {b20Activated === false && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          B20 is not activated on Base mainnet yet.
        </div>
      )}

      <LaunchConfigSummary config={formConfig} ethUsd={ethUsd} />

      <form onSubmit={onSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 space-y-5">
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Token identity</p>

            <div className="flex gap-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="shrink-0 w-24 h-24 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] flex flex-col items-center justify-center gap-1 overflow-hidden"
              >
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <ImagePlus size={22} className="text-[var(--ink-muted)]" />
                    <span className="text-[9px] font-bold text-slate-500">Image</span>
                  </>
                )}
              </button>
              {imagePreview && (
                <button type="button" onClick={() => { revokePreviewUrl(imagePreview); setImagePreview(null); setImageBlob(null); }} className="text-[10px] text-rose-400 self-start">
                  <X size={12} className="inline" /> Remove
                </button>
              )}

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block sm:col-span-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Token name *</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={32}
                    placeholder="My Token"
                    className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Symbol *</span>
                  <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    required
                    maxLength={10}
                    placeholder="TOKEN"
                    className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Quote token *</span>
                  <select
                    value={quoteToken}
                    onChange={(e) => setQuoteToken(e.target.value as QuoteToken)}
                    className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]"
                  >
                    <option value="ETH">ETH</option>
                    <option value="USDC">USDC</option>
                  </select>
                </label>
              </div>
            </div>

            <label className="block">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="What is this token about?"
                className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none resize-none focus:border-[var(--accent)]"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Start price (USD per token)</span>
              <input
                value={startPriceUsd}
                onChange={(e) => setStartPriceUsd(e.target.value)}
                className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none focus:border-[var(--accent)]"
              />
            </label>

            <p className="text-[10px] font-bold text-slate-500 uppercase">Links (optional)</p>
            <div className="grid grid-cols-1 gap-2">
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourproject.xyz" className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]" />
              <input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/yourproject" className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]" />
              <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/yourproject" className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]" />
              <input value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="https://discord.gg/yourproject" className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--accent)]" />
            </div>
          </div>

          <VanityAddressCard
            address={vanityAddress}
            attempts={vanityAttempts}
            grinding={grinding}
            onRefresh={() => void runVanityGrind()}
          />

          <LaunchOptionsPanel
            metadataEditable={metadataEditable}
            onMetadataEditable={setMetadataEditable}
            creatorPct={creatorPct}
            onCreatorPct={(v) => {
              setActivePreset(null);
              setCreatorPct(v);
            }}
            insiders={insiders}
            onInsiders={(v) => {
              setActivePreset(null);
              setInsiders(v);
            }}
            vested={vested}
            onVested={(v) => {
              setActivePreset(null);
              setVested(v);
            }}
            poolPct={poolPct}
            activePreset={activePreset}
            onPreset={applyPreset}
            antiSnipeBlocks={antiSnipeBlocks}
            onAntiSnipeBlocks={setAntiSnipeBlocks}
          />

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSeedLiquidity}
                onChange={(e) => setAutoSeedLiquidity(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="text-sm font-bold text-white block">
                  Auto-seed Aerodrome pool (enables in-app swaps)
                </span>
                <span className="text-[11px] text-slate-400">
                  Mints matching tokens + adds WETH liquidity right after launch.
                </span>
              </span>
            </label>
            {autoSeedLiquidity && (
              <>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  Seed pool on
                </span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(
                    [
                      ["aerodrome", "Aerodrome"],
                      ["uniswap", "Uniswap V3"],
                      ["both", "Both (50/50 split)"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSeedDex(id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        seedDex === id
                          ? "border-[var(--border-focus)] bg-[var(--bg-hover)] text-[var(--ink)]"
                          : "border-white/10 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </label>
              <label className="block">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    ETH for initial liquidity
                  </span>
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
                  value={seedLiquidityEth}
                  onChange={(e) => setSeedLiquidityEth(e.target.value)}
                  className="mt-1 w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none focus:border-[var(--border-focus)]"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SEED_LIQUIDITY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSeedLiquidityEth(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        seedLiquidityEth === preset
                          ? "border-[var(--border-focus)] bg-[var(--bg-hover)] text-[var(--ink)]"
                          : "border-white/10 text-slate-500 hover:text-slate-300"
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
                {seedPreview && (
                  <p className="text-[11px] text-[var(--ink-muted)] mt-2">
                    ~{formatCompact(seedPreview.tokenHuman)} {symbol || "tokens"} minted to your
                    wallet for the pool
                    {seedUsd != null ? ` · ${formatUsd(seedUsd)} liquidity` : ""}
                  </p>
                )}
              </label>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={
              launchLoading ||
              imageUploading ||
              !wallet ||
              b20Activated !== true ||
              !vanitySalt ||
              grinding
            }
            className="w-full py-4 rounded-2xl font-black text-base bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {launchLoading || imageUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {imageUploading ? "Uploading image…" : "Confirm in wallet…"}
              </>
            ) : (
              <>
                <Upload size={18} />
                Launch token
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            One B20 factory transaction mints liquid allocations atomically. Vested % (
            {vestedPct}%) and pool seed ({poolPct}%) stay unminted. Gas ~$0.05–$0.15 on Base.
            Every transaction includes builder code{" "}
            <span className="font-mono text-[var(--ink-muted)]">{BUILDER_CODE}</span>. Rabby may warn
            &quot;not a contract&quot; on the B20 factory (
            <span className="font-mono text-slate-400">0xB20f…</span>) — that is not your token;
            your token address starts with <span className="font-mono text-emerald-400/90">0xB200…</span>.
          </p>
        </div>

        <div className="xl:col-span-5">
          <TokenLaunchPreview
            data={{
              name,
              symbol,
              description,
              imagePreview,
              website,
              twitter,
              supplyCap: "1B",
              walletPct: creatorPct,
              mintAmount: creatorTokens,
              predictedAddress: vanityAddress,
              poolPct,
              vestedPct,
              quoteToken,
            }}
          />
        </div>
      </form>
    </div>
  );
}
