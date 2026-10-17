"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { parseUnits } from "viem";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { computeLaunchSalt, mergeMintAllocations, predictB20Address } from "@/lib/b20/encode";
import { uploadLaunchpadImage } from "@/lib/api/launchpad-client";
import { prepareTokenImage, revokePreviewUrl } from "@/lib/launchpad/image-upload";
import type { LaunchedToken, LaunchTokenType } from "@/lib/launchpad/types";
import {
  FIXED_LAUNCH_SUPPLY,
  type InsiderAllocation,
  type VestedAllocation,
} from "@/lib/launchpad/launch-config";
import type { LaunchPresetId } from "@/lib/launchpad/launch-presets";
import {
  computeLiquiditySeedAmounts,
  DEFAULT_SEED_LIQUIDITY_ETH,
  MIN_SEED_LIQUIDITY_ETH,
  type SeedDex,
} from "@/lib/launchpad/seed-liquidity";
import { grindVanityAddress } from "@/lib/launchpad/vanity-salt";
import { BASE_STOCKS, OPENLAUNCH_LOCKER_BASE, type BaseStock } from "@/lib/stocks/base-stocks";
import {
  DEFAULT_STARTING_PRICE_USD,
  DEFAULT_LOCK_DURATION_DAYS,
  DEFAULT_ANTI_SNIPE_BLOCKS,
  type LaunchVenueId,
  saveLaunchDraft,
  loadLaunchDraft,
  clearLaunchDraft,
} from "@/lib/launchpad/launch-configs";

// Sub-components
import LaunchHeader from "@/components/launchpad/LaunchHeader";
import LaunchTypeSelector from "@/components/launchpad/LaunchTypeSelector";
import QuoteAssetPicker from "@/components/launchpad/QuoteAssetPicker";
import IdentityStep from "@/components/launchpad/IdentityStep";
import DistributionStep from "@/components/launchpad/DistributionStep";
import LiquidityStep from "@/components/launchpad/LiquidityStep";
import ReviewStep from "@/components/launchpad/ReviewStep";
import LaunchSummaryPanel from "@/components/launchpad/LaunchSummaryPanel";
import LaunchSuccessPanel from "@/components/launchpad/LaunchSuccessPanel";
import WhatYouGetSection from "@/components/launchpad/WhatYouGetSection";

const STEPS = [
  { id: 1, title: "Type", subtitle: "Select asset model" },
  { id: 2, title: "Identity", subtitle: "Name, symbol & logo" },
  { id: 3, title: "Distribution", subtitle: "Token allocations" },
  { id: 4, title: "Liquidity", subtitle: "Pool & protection" },
  { id: 5, title: "Review", subtitle: "Verify & launch" },
];

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
  const { wallet, launchLoading, b20Activated, handleLaunchB20, showToast, setShowModal } = app;
  const isConnected = !!wallet?.address;

  // Form State
  const [currentStep, setCurrentStep] = useState(1);
  const [launchType, setLaunchType] = useState<LaunchTokenType>("b20");
  const [selectedStock, setSelectedStock] = useState<BaseStock>(BASE_STOCKS[1]); // NVDAc by default
  const [stockPrices, setStockPrices] = useState<Record<string, number>>({});

  // Identity
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const discord = "";
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | undefined>();

  // Distribution
  const [creatorPct, setCreatorPct] = useState(10);
  const [insiders, setInsiders] = useState<InsiderAllocation[]>([]);
  const [vested, setVested] = useState<VestedAllocation[]>([]);
  const [activePreset, setActivePreset] = useState<LaunchPresetId | null>("creator");

  // Liquidity & Protection
  const [autoSeedLiquidity, setAutoSeedLiquidity] = useState(true);
  const [seedDex, setSeedDex] = useState<LaunchVenueId>("aerodrome");
  const [seedLiquidityEth, setSeedLiquidityEth] = useState(DEFAULT_SEED_LIQUIDITY_ETH);
  const [liquidityLocked, setLiquidityLocked] = useState(true);
  const [lockDurationDays, setLockDurationDays] = useState(DEFAULT_LOCK_DURATION_DAYS);
  const [antiSnipeBlocks, setAntiSnipeBlocks] = useState(DEFAULT_ANTI_SNIPE_BLOCKS);
  const [metadataEditable, setMetadataEditable] = useState(false);
  const startPriceUsd = DEFAULT_STARTING_PRICE_USD;

  // Background Vanity & ETH data
  const [vanitySalt, setVanitySalt] = useState<`0x${string}` | null>(null);
  const [vanityAddress, setVanityAddress] = useState<string | null>(null);
  const [vanityAttempts, setVanityAttempts] = useState(0);
  const [grinding, setGrinding] = useState(false);
  const [ethUsd, setEthUsd] = useState(2500);

  // Success & Error States
  const [launchedToken, setLaunchedToken] = useState<LaunchedToken | null>(null);
  const [launchStepStatus, setLaunchStepStatus] = useState<string>("");
  const [launchError, setLaunchError] = useState<{
    step: "deploy" | "attribution" | "general";
    message: string;
  } | null>(null);

  // Restore draft on mount
  useEffect(() => {
    const draft = loadLaunchDraft();
    if (draft) {
      if (draft.step) setCurrentStep(draft.step);
      if (draft.launchType) setLaunchType(draft.launchType);
      if (draft.name) setName(draft.name);
      if (draft.symbol) setSymbol(draft.symbol);
      if (draft.description) setDescription(draft.description);
      if (draft.website) setWebsite(draft.website);
      if (draft.twitter) setTwitter(draft.twitter);
      if (draft.telegram) setTelegram(draft.telegram);
      if (draft.creatorPct !== undefined) setCreatorPct(draft.creatorPct);
      if (draft.insiders) setInsiders(draft.insiders);
      if (draft.vested) setVested(draft.vested);
      if (draft.autoSeedLiquidity !== undefined) setAutoSeedLiquidity(draft.autoSeedLiquidity);
      if (draft.seedLiquidityEth) setSeedLiquidityEth(draft.seedLiquidityEth);
      if (draft.seedDex) setSeedDex(draft.seedDex);
      if (draft.liquidityLocked !== undefined) setLiquidityLocked(draft.liquidityLocked);
      if (draft.lockDurationDays) setLockDurationDays(draft.lockDurationDays);
      if (draft.antiSnipeBlocks !== undefined) setAntiSnipeBlocks(draft.antiSnipeBlocks);
      if (draft.metadataEditable !== undefined) setMetadataEditable(draft.metadataEditable);
      if (draft.selectedStockSymbol) {
        const found = BASE_STOCKS.find((s) => s.symbol === draft.selectedStockSymbol);
        if (found) setSelectedStock(found);
      }
    }
  }, []);

  // Save draft whenever state changes
  useEffect(() => {
    saveLaunchDraft({
      step: currentStep,
      launchType,
      selectedStockSymbol: selectedStock.symbol,
      name,
      symbol,
      description,
      website,
      twitter,
      telegram,
      discord,
      creatorPct,
      insiders,
      vested,
      autoSeedLiquidity,
      seedLiquidityEth,
      seedDex,
      liquidityLocked,
      lockDurationDays,
      antiSnipeBlocks,
      metadataEditable,
      startPriceUsd,
    });
  }, [
    currentStep,
    launchType,
    selectedStock.symbol,
    name,
    symbol,
    description,
    website,
    twitter,
    telegram,
    discord,
    creatorPct,
    insiders,
    vested,
    autoSeedLiquidity,
    seedLiquidityEth,
    seedDex,
    liquidityLocked,
    lockDurationDays,
    antiSnipeBlocks,
    metadataEditable,
    startPriceUsd,
  ]);

  const handleClearDraft = () => {
    clearLaunchDraft();
    setName("");
    setSymbol("");
    setDescription("");
    setWebsite("");
    setTwitter("");
    setTelegram("");
    setCreatorPct(10);
    setInsiders([]);
    setVested([]);
    setImagePreview(null);
    setImageBlob(null);
    setCurrentStep(1);
    showToast("Launch form draft cleared", "");
  };

  // Fetch ETH price
  useEffect(() => {
    void fetch("/api/launchpad/eth-price")
      .then((r) => r.json())
      .then((d: { ethUsd?: number }) => setEthUsd(d.ethUsd ?? 2500))
      .catch(() => {});
  }, []);

  // Fetch stock prices
  useEffect(() => {
    void fetch("/api/stocks/markets")
      .then((r) => r.json())
      .then((d: { data?: Array<{ symbol: string; nav: number }> }) => {
        if (d.data && Array.isArray(d.data)) {
          const map: Record<string, number> = {};
          d.data.forEach((s) => {
            map[s.symbol] = s.nav;
          });
          setStockPrices(map);
        }
      })
      .catch(() => {});
  }, []);

  // Run Vanity Grind in background
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
      }
    } finally {
      setGrinding(false);
    }
  }, [wallet, name, symbol]);

  useEffect(() => {
    if (!wallet) return;
    const t = setTimeout(() => void runVanityGrind(), 400);
    return () => clearTimeout(t);
  }, [wallet, runVanityGrind]);

  // Image upload
  const onPickImage = async (file: File | null) => {
    if (!file) return;
    try {
      const prepared = await prepareTokenImage(file);
      revokePreviewUrl(imagePreview);
      setImagePreview(prepared.previewUrl);
      setImageBlob(prepared.blob);
      setImageUrl(undefined);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Invalid image format", "");
    }
  };

  const onRemoveImage = () => {
    revokePreviewUrl(imagePreview);
    setImagePreview(null);
    setImageBlob(null);
    setImageUrl(undefined);
  };

  // Allocations calculations
  const insiderTotalPct = insiders.reduce((s, i) => s + (i.pct || 0), 0);
  const vestedTotalPct = vested.reduce((s, v) => s + (v.pct || 0), 0);
  const allocatedPct = creatorPct + insiderTotalPct + vestedTotalPct;
  const poolReservePct = Math.max(0, 100 - allocatedPct);

  const effectiveQuoteSymbol = launchType === "memestock" ? selectedStock.symbol : "ETH";
  const effectiveQuoteAddress = launchType === "memestock" ? selectedStock.address : undefined;

  // Validation
  const validationError = useMemo(() => {
    if (!name.trim()) return "Token name is required";
    if (!symbol.trim()) return "Symbol ticker is required";
    if (allocatedPct > 100) return "Total allocations exceed 100%";
    if (autoSeedLiquidity && seedLiquidityEth) {
      const seedNum = parseFloat(seedLiquidityEth);
      if (!Number.isFinite(seedNum) || seedNum < parseFloat(MIN_SEED_LIQUIDITY_ETH)) {
        return `Minimum liquidity seed is ${MIN_SEED_LIQUIDITY_ETH} ETH`;
      }
    }
    return null;
  }, [name, symbol, allocatedPct, autoSeedLiquidity, seedLiquidityEth]);

  const isFormValid = !validationError;

  // Multi-step navigation validation
  const canGoNextFromStep = (step: number): boolean => {
    if (step === 1) return true;
    if (step === 2) return !!name.trim() && !!symbol.trim();
    if (step === 3) return allocatedPct <= 100;
    if (step === 4) return true;
    return true;
  };

  // Final Launch Action
  const handleExecuteLaunch = async () => {
    if (!wallet || !vanitySalt) return;
    if (b20Activated === false) {
      showToast("B20 is not activated on Base mainnet yet", "");
      return;
    }
    if (allocatedPct > 100) {
      showToast("Allocations cannot exceed 100% of supply", "");
      return;
    }

    setLaunchError(null);
    setLaunchStepStatus("Uploading metadata & preparing contract…");

    const supplyHuman = parseFloat(FIXED_LAUNCH_SUPPLY);
    const decimals = 18;
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
      const seed = computeLiquiditySeedAmounts({
        seedEth: seedLiquidityEth,
        startPriceUsd,
        ethUsd,
        decimals,
      });
      if (seed && seed.tokenWei > BigInt(0)) {
        mints.push({
          to: wallet.address as `0x${string}`,
          amount: seed.tokenWei,
        });
      }
    }

    const mergedMints = mergeMintAllocations(mints);

    let finalImageUrl = imageUrl;
    if (imageBlob && !finalImageUrl) {
      setImageUploading(true);
      try {
        finalImageUrl = (await uploadLaunchpadImage(imageBlob)) ?? undefined;
        setImageUrl(finalImageUrl);
      } catch {
        // Continue if image upload fails
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

    try {
      setLaunchStepStatus("Confirm in your wallet…");
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
        poolSeedPct: poolReservePct,
        quoteToken: effectiveQuoteSymbol,
        startPriceUsd,
        launchPreset: activePreset ?? undefined,
        vestingSchedule: vestingSchedule.length > 0 ? vestingSchedule : undefined,
        antiSnipeBlocks,
        seedLiquidityEth: autoSeedLiquidity ? seedLiquidityEth : undefined,
        autoSeedLiquidity,
        seedDex: autoSeedLiquidity ? (seedDex as SeedDex) : undefined,
        ethUsd,
        tokenType: launchType,
        quoteAsset: effectiveQuoteSymbol,
        quoteAssetAddress: effectiveQuoteAddress,
        quoteAssetSymbol: effectiveQuoteSymbol,
        liquidityLocked,
        lockerAddress: liquidityLocked ? OPENLAUNCH_LOCKER_BASE : undefined,
      });

      if (result.ok && result.address) {
        clearLaunchDraft();
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
          tokenType: launchType,
          quoteAsset: effectiveQuoteSymbol,
          quoteAssetAddress: effectiveQuoteAddress,
          quoteAssetSymbol: effectiveQuoteSymbol,
          liquidityLocked,
          lockerAddress: liquidityLocked ? OPENLAUNCH_LOCKER_BASE : undefined,
          creatorFeeBps: 25,
          platformFeeBps: 25,
        });
        onLaunched?.();
      } else {
        setLaunchError({
          step: "deploy",
          message: "Transaction rejected or simulation failed. Please retry.",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deployment failed";
      const isAttribution = msg.toLowerCase().includes("attribution");
      setLaunchError({
        step: isAttribution ? "attribution" : "deploy",
        message: msg,
      });
    } finally {
      setLaunchStepStatus("");
    }
  };

  // If already launched successfully, show Success screen
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

  return (
    <div className="space-y-6">
      {/* 1. Header with 3 Facts */}
      <LaunchHeader />

      {/* 2. Main 5-Step Guided Flow & Sticky Summary Grid */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Progress Stepper + Current Step Form */}
        <div className="lg:col-span-8 space-y-6">
          {/* Step Progress Indicator Bar */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 sm:p-4">
            <div className="flex items-center justify-between">
              {STEPS.map((s, idx) => {
                const isCurrent = currentStep === s.id;
                const isPast = currentStep > s.id;
                const isClickable = s.id < currentStep || canGoNextFromStep(s.id - 1);

                return (
                  <React.Fragment key={s.id}>
                    <button
                      type="button"
                      disabled={!isClickable}
                      onClick={() => isClickable && setCurrentStep(s.id)}
                      className={`flex items-center gap-2 group text-left cursor-pointer transition ${
                        !isClickable ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition ${
                          isCurrent
                            ? "bg-[#0052FF] text-white shadow-xs"
                            : isPast
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                              : "bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]"
                        }`}
                      >
                        {isPast ? <Check size={13} strokeWidth={3} /> : s.id}
                      </span>
                      <div className="hidden sm:block">
                        <p
                          className={`text-xs font-bold leading-none ${
                            isCurrent ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"
                          }`}
                        >
                          {s.title}
                        </p>
                        <p className="text-[10px] text-[var(--ink-dim)] mt-0.5">{s.subtitle}</p>
                      </div>
                    </button>

                    {idx < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 rounded-full transition ${
                          currentStep > s.id ? "bg-[#0052FF]" : "bg-[var(--border-subtle)]"
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className="min-h-[420px]">
            {/* Step 1: Type Selection */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-meridian-fade">
                <LaunchTypeSelector value={launchType} onChange={setLaunchType} />
                {launchType === "memestock" && (
                  <QuoteAssetPicker
                    selectedStock={selectedStock}
                    onSelectStock={setSelectedStock}
                    stockPrices={stockPrices}
                  />
                )}
              </div>
            )}

            {/* Step 2: Identity & Branding */}
            {currentStep === 2 && (
              <div className="animate-meridian-fade">
                <IdentityStep
                  name={name}
                  onNameChange={setName}
                  symbol={symbol}
                  onSymbolChange={setSymbol}
                  description={description}
                  onDescriptionChange={setDescription}
                  website={website}
                  onWebsiteChange={setWebsite}
                  twitter={twitter}
                  onTwitterChange={setTwitter}
                  telegram={telegram}
                  onTelegramChange={setTelegram}
                  imagePreview={imagePreview}
                  onPickImage={onPickImage}
                  onRemoveImage={onRemoveImage}
                  imageUploading={imageUploading}
                />
              </div>
            )}

            {/* Step 3: Distribution */}
            {currentStep === 3 && (
              <div className="animate-meridian-fade">
                <DistributionStep
                  creatorPct={creatorPct}
                  onCreatorPctChange={setCreatorPct}
                  insiders={insiders}
                  onInsidersChange={setInsiders}
                  vested={vested}
                  onVestedChange={setVested}
                  activePreset={activePreset}
                  onSelectPreset={setActivePreset}
                />
              </div>
            )}

            {/* Step 4: Liquidity & Protection */}
            {currentStep === 4 && (
              <div className="animate-meridian-fade">
                <LiquidityStep
                  autoSeedLiquidity={autoSeedLiquidity}
                  onAutoSeedLiquidityChange={setAutoSeedLiquidity}
                  seedDex={seedDex}
                  onSeedDexChange={setSeedDex}
                  seedLiquidityEth={seedLiquidityEth}
                  onSeedLiquidityEthChange={setSeedLiquidityEth}
                  liquidityLocked={liquidityLocked}
                  onLiquidityLockedChange={setLiquidityLocked}
                  lockDurationDays={lockDurationDays}
                  onLockDurationDaysChange={setLockDurationDays}
                  antiSnipeBlocks={antiSnipeBlocks}
                  onAntiSnipeBlocksChange={setAntiSnipeBlocks}
                  metadataEditable={metadataEditable}
                  onMetadataEditableChange={setMetadataEditable}
                  ethUsd={ethUsd}
                  startPriceUsd={startPriceUsd}
                />
              </div>
            )}

            {/* Step 5: Review & Deploy */}
            {currentStep === 5 && (
              <div className="animate-meridian-fade">
                <ReviewStep
                  launchType={launchType}
                  selectedStock={selectedStock}
                  name={name}
                  symbol={symbol}
                  imagePreview={imagePreview}
                  creatorPct={creatorPct}
                  insiderTotalPct={insiderTotalPct}
                  vestedTotalPct={vestedTotalPct}
                  poolReservePct={poolReservePct}
                  autoSeedLiquidity={autoSeedLiquidity}
                  seedDex={seedDex}
                  seedLiquidityEth={seedLiquidityEth}
                  liquidityLocked={liquidityLocked}
                  lockDurationDays={lockDurationDays}
                  antiSnipeBlocks={antiSnipeBlocks}
                  metadataEditable={metadataEditable}
                  startPriceUsd={startPriceUsd}
                  ethUsd={ethUsd}
                  vanityAddress={vanityAddress}
                  isConnected={isConnected}
                  onRequestConnect={() => setShowModal(true)}
                  isLaunching={launchLoading}
                  launchStateText={launchStepStatus}
                  launchError={launchError}
                  onLaunch={() => void handleExecuteLaunch()}
                  onRetry={() => void handleExecuteLaunch()}
                  isFormValid={isFormValid}
                  validationError={validationError}
                />
              </div>
            )}
          </div>

          {/* Stepper Navigation Buttons (Back & Next) */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              disabled={currentStep === 1 || launchLoading}
              onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
              className="py-2.5 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs font-bold text-[var(--ink)] hover:text-[#0052FF] hover:border-[#0052FF] transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowLeft size={14} /> Back
            </button>

            {currentStep < 5 && (
              <button
                type="button"
                disabled={!canGoNextFromStep(currentStep)}
                onClick={() => setCurrentStep((p) => Math.min(5, p + 1))}
                className="py-2.5 px-5 rounded-xl bg-[#0052FF] text-white hover:bg-[#0047e0] text-xs font-bold shadow-sm transition flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Next <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Sticky Live Preview, Pricing & Summary */}
        <div className="lg:col-span-4">
          <LaunchSummaryPanel
            name={name}
            symbol={symbol}
            description={description}
            imagePreview={imagePreview}
            website={website}
            twitter={twitter}
            telegram={telegram}
            quoteSymbol={effectiveQuoteSymbol}
            startPriceUsd={startPriceUsd}
            launchType={launchType}
            creatorPct={creatorPct}
            poolReservePct={poolReservePct}
            vestedTotalPct={vestedTotalPct}
            vanityAddress={vanityAddress}
            vanityAttempts={vanityAttempts}
            grinding={grinding}
            autoSeedLiquidity={autoSeedLiquidity}
            seedLiquidityEth={seedLiquidityEth}
            seedDex={seedDex}
            liquidityLocked={liquidityLocked}
            lockDurationDays={lockDurationDays}
            ethUsd={ethUsd}
            onClearDraft={handleClearDraft}
          />
        </div>
      </div>

      {/* 3. Collapsible "What you get" section at the bottom */}
      <WhatYouGetSection />
    </div>
  );
}
