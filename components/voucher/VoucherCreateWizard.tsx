"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Info,
  AlertTriangle,
  Minus,
  Plus,
  Loader2,
  Coins,
  Layers,
  Palette,
  Send,
  Gift,
  TrendingUp,
  Zap,
} from "lucide-react";
import ActivePill from "@/components/ui/motion/ActivePill";
import ClickSpark from "@/components/ui/motion/ClickSpark";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
import { formatUnits } from "viem";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";
import {
  MAX_VOUCHER_CARDS,
  formatSplitSummary,
  formatVoucherAmount,
  isStockAsset,
  isVaultShareAsset,
  getVaultShareBySymbol,
} from "@/lib/utils/voucher";
import { getBaseStockBySymbol, BASE_STOCK_DECIMALS } from "@/lib/stocks/base-stocks";
import { getStockTradability } from "@/lib/stocks/stock-tradability";
import {
  OCCASION_TEMPLATES,
  CARD_THEME_OPTIONS,
  QUICK_CARD_PRESETS,
} from "./voucher-constants";
import type { CardTheme, VoucherAssetCategory } from "./voucher-types";
import VoucherCardPreview from "./VoucherCardPreview";
import { SplitVisual, StepHeader, StepSlide, WizardStepper } from "./WizardChrome";
import VoucherAssetPickerModal from "./VoucherAssetPickerModal";
import TokenLogo from "@/components/ui/TokenLogo";
import type { useVoucherTab } from "@/hooks/useVoucherTab";

type VoucherTab = ReturnType<typeof useVoucherTab>;

interface VoucherCreateWizardProps {
  shared: VoucherTab["shared"];
  create: VoucherTab["create"];
  userBalances?: Record<string, number>;
  ethBalance?: string;
  usdcBalance?: string;
}

export default function VoucherCreateWizard({
  shared,
  create,
  userBalances = {},
  ethBalance = "0.00",
  usdcBalance = "0.00",
}: VoucherCreateWizardProps) {
  const { contractReady, address } = shared;
  const {
    asset,
    setAsset,
    totalAmount,
    setTotalAmount,
    cardCountInput,
    setCardCountInput,
    message,
    setMessage,
    unlockHours,
    setUnlockHours,
    expirationDays,
    setExpirationDays,
    creating,
    pendingCards,
    split,
    perCardWei,
    prepareCreate,
    cancelPendingCreate,
    pendingAsset,
    exactDepositLabel,
    needsUsdcApproval,
    confirmingDeposit,
    checkingAllowance,
    usdcAllowanceError,
    refreshUsdcAllowance,
    directApproving,
    directFunding,
    executeDirectApprove,
    executeDirectDeposit,
  } = create;

  const reduceMotion = useReducedMotion();

  // Wizard step state (1 to 4)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  // Slide direction for step transitions (forward = from the right)
  const [prevStep, setPrevStep] = useState(currentStep);
  const [direction, setDirection] = useState(1);
  if (prevStep !== currentStep) {
    setDirection(currentStep > prevStep ? 1 : -1);
    setPrevStep(currentStep);
  }

  // Card theme state
  const [cardTheme, setCardTheme] = useState<CardTheme>("base-blue");

  // Asset picker modal state
  const [pickerModal, setPickerModal] = useState<{
    open: boolean;
    category: "stock" | "vault";
  }>({
    open: false,
    category: "stock",
  });

  const isVault = isVaultShareAsset(asset);
  const isStock = isStockAsset(asset);
  const stockInfo = !isVault && isStock ? getBaseStockBySymbol(asset) : null;
  const vaultInfo = isVault ? getVaultShareBySymbol(asset) : null;

  const stockTradability = useMemo(() => {
    if (!isStock) return null;
    return getStockTradability(stockInfo?.address || asset);
  }, [isStock, stockInfo?.address, asset]);

  // Identify current asset category
  const activeCategory: VoucherAssetCategory = isVault
    ? "vault"
    : isStock
      ? "stock"
      : asset === "ETH"
        ? "eth"
        : "usdc";

  // Available balance for current asset
  const currentAssetBalance = useMemo(() => {
    if (asset === "USDC") return parseFloat(usdcBalance) || 0;
    if (asset === "ETH") return parseFloat(ethBalance) || 0;
    if (isStock && stockInfo) {
      return userBalances[stockInfo.address.toLowerCase()] || 0;
    }
    if (isVault && vaultInfo) {
      return userBalances[vaultInfo.address.toLowerCase()] || 0;
    }
    return 0;
  }, [asset, usdcBalance, ethBalance, isStock, stockInfo, isVault, vaultInfo, userBalances]);

  // Estimated USD value of total amount
  // Only shown when exact (USDC). ETH / stock / vault prices are not known here, so no guess.
  const estimatedUsdValue = useMemo(() => {
    const num = parseFloat(totalAmount);
    if (!Number.isFinite(num) || num <= 0) return null;
    if (asset === "USDC") return `${num.toFixed(2)}`;
    return null;
  }, [totalAmount, asset]);

  const isStep2OverBalance = useMemo(() => {
    const val = parseFloat(totalAmount);
    return Number.isFinite(val) && currentAssetBalance > 0 && val > currentAssetBalance;
  }, [totalAmount, currentAssetBalance]);

  const pendingTotalRaw = pendingCards ? BigInt(pendingCards.totalAmount) : BigInt(0);
  const pendingAssetDecimals = isStock || isVault ? BASE_STOCK_DECIMALS : pendingAsset === "USDC" ? 6 : 18;
  const isPendingOverBalance = useMemo(() => {
    if (!pendingCards || currentAssetBalance <= 0) return false;
    const requiredNum = parseFloat(formatUnits(pendingTotalRaw, pendingAssetDecimals));
    return requiredNum > currentAssetBalance;
  }, [pendingCards, currentAssetBalance, pendingTotalRaw, pendingAssetDecimals]);

  // Card count adjustments
  const incrementCardCount = () => {
    const next = Math.min(MAX_VOUCHER_CARDS, Math.max(1, (parseInt(cardCountInput, 10) || 1) + 1));
    setCardCountInput(String(next));
  };

  const decrementCardCount = () => {
    const next = Math.max(1, (parseInt(cardCountInput, 10) || 1) - 1);
    setCardCountInput(String(next));
  };

  const handlePrepareCreate = async () => {
    await prepareCreate();
    setCurrentStep(4);
  };

  return (
    <div className="space-y-6">
      {/* Pending Draft Alert with 1-click Discard / Resume */}
      {pendingCards && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div>
            <p className="text-xs font-black text-[var(--ink)]">
              Draft Batch #{pendingCards.batchId} in Progress
            </p>
            <p className="text-[11px] text-[var(--ink-muted)] mt-0.5">
              Prepared for {exactDepositLabel} · {pendingCards.cardCount} cards. Resume this batch or discard to start fresh with a new amount.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {currentStep !== 4 && (
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="pop-pill px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--brand)] text-white hover:opacity-90 transition cursor-pointer"
              >
                Resume Draft →
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                cancelPendingCreate();
                setCurrentStep(1);
              }}
              className="pop-pill px-3.5 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25 hover:bg-red-500/20 transition cursor-pointer"
            >
              Discard &amp; Start Fresh
            </button>
          </div>
        </div>
      )}

      {/* Step indicator: icons + a track that fills as you go */}
      <WizardStepper
        steps={[
          { step: 1, title: "Asset", hint: asset, icon: Coins },
          { step: 2, title: "Amount", hint: `${cardCountInput || 1} ${cardCountInput === "1" ? "card" : "cards"}`, icon: Layers },
          { step: 3, title: "Personalize", hint: CARD_THEME_OPTIONS.find((t) => t.id === cardTheme)?.label ?? cardTheme, icon: Palette },
          { step: 4, title: "Send", hint: "Review & create", icon: Send },
        ]}
        current={currentStep}
        onSelect={(st) => setCurrentStep(st as 1 | 2 | 3 | 4)}
        isDisabled={(st) => !!pendingCards && st < 4}
      />

      {/* Two-Column Layout (Desktop) / Collapsed Preview (Mobile) */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Mobile Live Card Preview (compact above form) */}
        <div className="block lg:hidden w-full">
          <VoucherCardPreview
            asset={asset}
            amount={perCardWei ?? undefined}
            message={message}
            theme={cardTheme}
            compact
          />
        </div>

        {/* Left Form Steps (Col 1 to 7) */}
        <div className="lg:col-span-7 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-7 shadow-sm">
          <AnimatePresence mode="wait" initial={false}>
          <StepSlide key={currentStep} direction={direction}>
          {/* STEP 1: ASSET SELECTION */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <StepHeader icon={Coins} step={1} total={4} title="What are you gifting?" description="Pick dollars, ETH, a real tokenized stock, or a yield vault." />

              {/* Segmented Category Control */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: "usdc", label: "USDC", sub: "Digital dollars" },
                  { id: "eth", label: "ETH", sub: "Ether" },
                  { id: "stock", label: "Stocks", sub: "Real companies" },
                  { id: "vault", label: "Vaults", sub: "Earns yield" },
                ].map((cat) => {
                  const isSelected = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={!!pendingCards}
                      onClick={() => {
                        if (cat.id === "usdc") {
                          setAsset("USDC");
                          setTotalAmount("10");
                        } else if (cat.id === "eth") {
                          setAsset("ETH");
                          setTotalAmount("0.01");
                        } else if (cat.id === "stock") {
                          setPickerModal({ open: true, category: "stock" });
                        } else if (cat.id === "vault") {
                          setPickerModal({ open: true, category: "vault" });
                        }
                      }}
                      className={`relative isolate flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                        isSelected
                          ? "border-[var(--brand)] text-[var(--ink)]"
                          : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:border-[var(--brand)]/40 hover:text-[var(--ink)]"
                      }`}
                    >
                      {isSelected && <ActivePill layoutId="gift-asset-pill" className="bg-[var(--brand-soft)]" />}
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface)] shadow-sm">
                        {cat.id === "usdc" ? (
                          <TokenLogo address={USDC_ADDRESS} symbol="USDC" size={28} />
                        ) : cat.id === "eth" ? (
                          <TokenLogo address="0x0000000000000000000000000000000000000000" symbol="ETH" size={28} />
                        ) : cat.id === "stock" ? (
                          <TrendingUp size={20} className="text-[var(--brand-text)]" />
                        ) : (
                          <Zap size={20} className="text-amber-500" />
                        )}
                      </span>
                      <span className="text-sm font-black">{cat.label}</span>
                      <span className="text-[11px] text-[var(--ink-muted)]">{cat.sub}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Asset Info Banner */}
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface)] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TokenLogo
                    address={stockInfo?.address || (asset === "USDC" ? USDC_ADDRESS : asset === "ETH" ? "0x0000000000000000000000000000000000000000" : undefined)}
                    symbol={asset}
                    size={40}
                    shape="rounded-xl"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-[var(--ink)]">{asset}</span>
                      {vaultInfo && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          +{vaultInfo.apy}% APY
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--ink-muted)]">
                      {isStock ? stockInfo?.name : isVault ? vaultInfo?.name : "Base Network Native"}
                    </p>
                  </div>
                </div>

                {(isStock || isVault) && (
                  <button
                    type="button"
                    onClick={() =>
                      setPickerModal({
                        open: true,
                        category: isStock ? "stock" : "vault",
                      })
                    }
                    className="pop-pill text-xs font-bold text-[var(--brand-text)] px-3 py-1.5 rounded-lg border border-[var(--brand)]/30 hover:bg-[var(--brand-soft)] transition cursor-pointer"
                  >
                    Change
                  </button>
                )}
              </div>

              {/* Tokenized Stock Liquidity & Tradability Safety Badge */}
              {isStock && stockTradability && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    stockTradability.status === "tradable"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                      : stockTradability.status === "low_liquidity"
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300"
                  }`}
                >
                  <AlertTriangle
                    size={14}
                    className={`shrink-0 mt-0.5 ${
                      stockTradability.status === "tradable"
                        ? "text-emerald-500"
                        : stockTradability.status === "low_liquidity"
                          ? "text-amber-500"
                          : "text-rose-500"
                    }`}
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold block">
                      {stockTradability.status === "tradable"
                        ? "Verified DEX Liquidity"
                        : stockTradability.status === "low_liquidity"
                          ? "Low DEX Liquidity Warning"
                          : "No Secondary Market Pool"}
                    </span>
                    <p className="text-[11px] opacity-90 leading-relaxed">
                      {stockTradability.status === "tradable"
                        ? "This tokenized stock has active liquidity on Base DEXes (Aerodrome / Uniswap)."
                        : stockTradability.status === "low_liquidity"
                          ? "This stock has limited DEX liquidity. Recipients may experience higher price impact if swapping."
                          : "No DEX pool is active on Base yet. Recipients cannot swap directly on DEXes, but can hold or use in supported lending protocols."}
                    </p>
                  </div>
                </div>
              )}

              {/* User Balance Display with "Max" button */}
              <div className="flex items-center justify-between px-1 text-xs">
                <span className="text-[var(--ink-muted)]">
                  Available in wallet:{" "}
                  <strong className="text-[var(--ink)] tabular-nums">
                    {currentAssetBalance.toFixed(4)} {asset}
                  </strong>
                </span>
                {currentAssetBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setTotalAmount(String(currentAssetBalance))}
                    className="pop-pill text-[10px] font-black uppercase text-[var(--brand-text)] bg-[var(--brand-soft)] px-2 py-0.5 rounded hover:bg-[var(--brand-soft)] transition cursor-pointer"
                  >
                    Use Max
                  </button>
                )}
              </div>

              {/* Step 1 Next Button */}
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm bg-[var(--brand)] text-white hover:opacity-90 active:scale-[0.98] transition cursor-pointer shadow-sm"
              >
                <span>Continue to Amount & Split</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 2: AMOUNT & SPLIT */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <StepHeader icon={Layers} step={2} total={4} title="How much, for how many?" description="Set the total and split it into equal gift cards (1 to 50)." />

              {/* Total Amount Input with USD value below */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                    Total Amount ({asset})
                  </label>
                  {currentAssetBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setTotalAmount(String(currentAssetBalance))}
                      className="text-[10px] font-black uppercase text-[var(--brand-text)] hover:underline"
                    >
                      Max: {currentAssetBalance.toFixed(4)}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder={isStock ? "1.0" : asset === "ETH" ? "0.01" : "10"}
                    className="w-full text-3xl sm:text-4xl font-black rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] px-5 py-5 pr-24 text-[var(--ink)] outline-none focus:border-[var(--brand)] focus:ring-4 focus:ring-[var(--brand)]/15 transition tabular-nums"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg bg-[var(--surface)] px-2.5 py-1 font-black text-sm text-[var(--ink-soft)] shadow-sm">
                    {asset}
                  </span>
                </div>
                {estimatedUsdValue && (
                  <p className="text-xs text-[var(--ink-muted)] mt-1.5 pl-1 tabular-nums">
                    = {estimatedUsdValue}
                  </p>
                )}
              </div>

              {/* Number of Cards Stepper (1-50) */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] mb-1.5 block">
                  Number of Cards (Max {MAX_VOUCHER_CARDS})
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={decrementCardCount}
                    className="w-12 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--ink)] hover:bg-[var(--border-subtle)]/50 transition cursor-pointer active:scale-95"
                  >
                    <Minus size={18} />
                  </button>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={cardCountInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d+$/.test(val)) {
                        setCardCountInput(val);
                      }
                    }}
                    onBlur={() => {
                      const n = parseInt(cardCountInput, 10);
                      if (!cardCountInput || !Number.isFinite(n) || n < 1) {
                        setCardCountInput("1");
                      } else if (n > MAX_VOUCHER_CARDS) {
                        setCardCountInput(String(MAX_VOUCHER_CARDS));
                      }
                    }}
                    className="flex-1 text-center text-xl font-black rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] py-3 text-[var(--ink)] outline-none focus:border-[var(--brand-text)] transition tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={incrementCardCount}
                    className="w-12 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--ink)] hover:bg-[var(--border-subtle)]/50 transition cursor-pointer active:scale-95"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {/* Quick Presets: 1 / 5 / 10 / 25 */}
                <div className="flex gap-2 mt-2.5">
                  {QUICK_CARD_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCardCountInput(String(p))}
                      className={`relative isolate flex-1 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        cardCountInput === String(p)
                          ? "text-white border-[var(--brand)]"
                          : "bg-[var(--surface-2)] text-[var(--ink-muted)] border-[var(--border-subtle)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {cardCountInput === String(p) && <ActivePill layoutId="gift-count-pill" className="bg-[var(--brand)]" />}
                      {p} {p === 1 ? "card" : "cards"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compact Split Breakdown Line */}
              {split && split.valid && !isStep2OverBalance && perCardWei && (
                <SplitVisual
                  count={Math.max(1, parseInt(cardCountInput, 10) || 1)}
                  perCard={formatVoucherAmount(asset, perCardWei)}
                />
              )}
              {split && (
                <div
                  className={`rounded-xl p-3 border text-xs flex items-center justify-between ${
                    split.valid && !isStep2OverBalance
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  <span className="font-bold">Split breakdown:</span>
                  <span className="font-mono font-black tabular-nums">
                    {split.valid
                      ? formatSplitSummary(split)
                      : "Adjust amount to split evenly"}
                  </span>
                </div>
              )}

              {isStep2OverBalance && (
                <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>Insufficient balance (wallet holds {currentAssetBalance.toFixed(4)} {asset})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTotalAmount(String(currentAssetBalance))}
                    className="pop-pill text-[10px] font-black uppercase text-red-700 dark:text-red-300 bg-red-500/20 px-2 py-0.5 rounded hover:bg-red-500/30 transition shrink-0 cursor-pointer"
                  >
                    Set Max
                  </button>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="pop-pill flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-xl font-bold text-xs sm:text-sm bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--border-subtle)]/40 transition cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  disabled={!perCardWei || isStep2OverBalance}
                  onClick={() => setCurrentStep(3)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm bg-[var(--brand)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition cursor-pointer shadow-sm"
                >
                  <span>Continue to Personalize</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PERSONALIZE */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <StepHeader icon={Palette} step={3} total={4} title="Make it personal" description="Pick an occasion, a card style and a message they will see." />

              {/* Occasion Templates (GM, Birthday, Thank you, Welcome, Team split) */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] mb-2 block">
                  Occasion Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {OCCASION_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => {
                        setMessage(tmpl.message);
                        setCardTheme(tmpl.theme);
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition cursor-pointer active:scale-[0.98] ${
                        message === tmpl.message
                          ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                          : "bg-[var(--surface-2)] border-[var(--border-subtle)] hover:border-[var(--brand)]/50"
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-xl shadow-sm">{tmpl.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[var(--ink)] truncate">
                          {tmpl.label}
                        </p>
                        <p className="text-[10px] text-[var(--ink-muted)] truncate">
                          {tmpl.message}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Theme Selector (Base Blue, Midnight, Stock, Mint) */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] mb-2 block">
                  Card Theme
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CARD_THEME_OPTIONS.map((themeOpt) => {
                    const isSelected = cardTheme === themeOpt.id;
                    return (
                      <button
                        key={themeOpt.id}
                        type="button"
                        onClick={() => setCardTheme(themeOpt.id)}
                        className={`flex flex-col items-stretch gap-2 p-2 rounded-2xl border transition cursor-pointer active:scale-[0.98] ${
                          isSelected
                            ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--ink)] ring-2 ring-[var(--brand)]/30"
                            : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                        }`}
                      >
                        <span
                          className="h-12 w-full rounded-xl border border-white/15 shadow-inner"
                          style={{ background: themeOpt.gradient || themeOpt.accentColor }}
                        />
                        <span className="text-xs font-black truncate text-center">{themeOpt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message Field with 280-char counter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                    Gift Message (Optional)
                  </label>
                  <span className="text-[10px] text-[var(--ink-muted)] font-mono">
                    {message.length} / 280
                  </span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 280))}
                  rows={3}
                  placeholder="e.g. Congratulations on shipping! Enjoy your onchain reward."
                  className="w-full text-sm rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3 text-[var(--ink)] outline-none focus:border-[var(--brand-text)] resize-none transition"
                />
              </div>

              {/* Time-Lock & Expiration Controls (Optional) */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔒</span>
                    <span className="text-xs font-bold text-[var(--ink)]">
                      Time-Lock &amp; Expiration (Optional)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-text)] bg-[var(--brand-soft)] px-2 py-0.5 rounded-full">
                    Base Contract v2
                  </span>
                </div>

                {/* Unlock Schedule */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[var(--ink-muted)]">
                    Unlock Time (Cannot be redeemed before)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { hours: 0, label: "Immediate" },
                      { hours: 24, label: "24 Hours" },
                      { hours: 72, label: "3 Days" },
                      { hours: 168, label: "7 Days" },
                    ].map((opt) => (
                      <button
                        key={opt.hours}
                        type="button"
                        onClick={() => setUnlockHours(opt.hours)}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition text-center cursor-pointer ${
                          unlockHours === opt.hours
                            ? "bg-[var(--brand)] text-white shadow-sm"
                            : "bg-[var(--surface)] text-[var(--ink)] border border-[var(--border-subtle)] hover:border-[var(--brand-text)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expiration & Reclaim Window */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[var(--ink-muted)]">
                      Expiration &amp; Reclaim Window
                    </label>
                    <span className="text-[10px] text-[var(--ink-muted)]">
                      Creator can reclaim unredeemed tokens
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { days: 0, label: "Never" },
                      { days: 14, label: "14 Days" },
                      { days: 30, label: "30 Days" },
                      { days: 90, label: "90 Days" },
                    ].map((opt) => (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setExpirationDays(opt.days)}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition text-center cursor-pointer ${
                          expirationDays === opt.days
                            ? "bg-[var(--brand)] text-white shadow-sm"
                            : "bg-[var(--surface)] text-[var(--ink)] border border-[var(--border-subtle)] hover:border-[var(--brand-text)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-xl font-bold text-xs sm:text-sm bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--border-subtle)]/40 transition cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm bg-[var(--brand)] text-white hover:opacity-90 active:scale-[0.98] transition cursor-pointer shadow-sm"
                >
                  <span>Review & Create</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & CREATE */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <StepHeader icon={Send} step={4} total={4} title="Ready to send" description="Check the details, then fund your gift cards on Base." />

              {/* Prominent Info Banner: One Card Per Wallet Rule */}
              <div className="rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-soft)] p-3.5 flex items-start gap-2.5">
                <Info size={18} className="text-[var(--brand-text)] shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-black text-[var(--ink)]">
                    One-card-per-wallet rule
                  </p>
                  <p className="text-[var(--ink-muted)] mt-0.5">
                    Each recipient wallet can claim exactly{" "}
                    <strong className="text-[var(--ink)]">one gift card per batch</strong>{" "}
                    (including your own wallet). Ensure you share unique links with distinct recipients.
                  </p>
                </div>
              </div>

              {/* Summary Breakdown Box */}
              <div className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-5 space-y-3 text-sm">
                {/* receipt header */}
                <div className="flex items-center justify-between pb-3 border-b border-dashed border-[var(--border-strong)]">
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--ink-muted)]">Gift receipt</span>
                  <span className="text-2xl" aria-hidden>🎁</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ink-muted)] font-medium">Gift Asset</span>
                  <span className="font-black text-[var(--ink)]">{asset}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ink-muted)] font-medium">Total Gift Deposit</span>
                  <span className="font-mono font-black text-[var(--ink)] tabular-nums">
                    {totalAmount} {asset}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ink-muted)] font-medium">Cards in Batch</span>
                  <span className="font-mono font-black text-[var(--ink)] tabular-nums">
                    {cardCountInput} cards
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ink-muted)] font-medium">Amount Per Card</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {perCardWei ? formatVoucherAmount(asset, perCardWei) : "—"}
                  </span>
                </div>
                {unlockHours > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--ink-muted)] font-medium">Time-Lock</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      🔒 Unlocks in {unlockHours} hours
                    </span>
                  </div>
                )}
                {expirationDays > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--ink-muted)] font-medium">Expiration &amp; Reclaim</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      ⏳ Expires in {expirationDays} days (creator reclaimable)
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--ink-muted)] font-medium">Network & Gas</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Sparkles size={12} /> Gas Sponsored on Base
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ink-muted)] font-medium">Contract</span>
                  <a
                    href={`https://basescan.org/address/${VOUCHER_CONTRACT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--brand-text)] hover:underline flex items-center gap-1 font-mono text-[11px]"
                  >
                    <span>BaseVoucher Verified</span>
                  </a>
                </div>
              </div>

              {/* Active Deposit / Creation State Machine Buttons */}
              <div className="pt-2">
                {!address ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-4 rounded-xl font-black text-sm bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]"
                  >
                    Connect Wallet to Create Gift Cards
                  </button>
                ) : !pendingCards ? (
                  <div className="space-y-3">
                    <ClickSpark className="w-full">
                      <button
                        type="button"
                        disabled={!contractReady || creating || !perCardWei}
                        onClick={handlePrepareCreate}
                        className="shine-button w-full py-4 rounded-2xl font-black text-base bg-gradient-to-r from-[var(--brand)] to-indigo-500 text-white hover:opacity-95 disabled:opacity-40 active:scale-[0.98] transition cursor-pointer shadow-lg shadow-[var(--brand)]/30 flex items-center justify-center gap-2"
                      >
                        {creating ? (
                          <>
                            <Loader2 size={18} className="animate-spin" /> Wrapping your gift…
                          </>
                        ) : (
                          <>
                            <Gift size={18} /> Create gift cards
                          </>
                        )}
                      </button>
                    </ClickSpark>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="w-full py-2.5 text-xs font-bold text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    >
                      ← Back to Personalize
                    </button>
                  </div>
                ) : (
                  /* Prepared batch: Confirm in wallet / Approve USDC / Deposit */
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                          Batch #{pendingCards.batchId} Ready to Fund
                        </p>
                        <p className="text-[11px] text-[var(--ink-muted)] mt-0.5">
                          Confirm transaction in wallet. Claim secrets will display immediately upon confirmation.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={cancelPendingCreate}
                        className="text-[10px] font-bold uppercase text-[var(--ink-muted)] hover:text-red-500 shrink-0"
                      >
                        Cancel
                      </button>
                    </div>

                    {confirmingDeposit && (
                      <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-center text-xs font-bold text-amber-700 dark:text-amber-300 animate-pulse">
                        Confirming deposit on Base… Keep this tab open.
                      </div>
                    )}

                    {isPendingOverBalance && (
                      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold">
                          <AlertTriangle size={16} className="shrink-0" />
                          <span>Insufficient {pendingAsset} balance in wallet</span>
                        </div>
                        <p className="text-[var(--ink-muted)]">
                          This batch requires <strong className="text-[var(--ink)]">{exactDepositLabel}</strong>, but your wallet only holds <strong className="text-[var(--ink)]">{currentAssetBalance.toFixed(4)} {pendingAsset}</strong>.
                        </p>
                        <button
                          type="button"
                          onClick={cancelPendingCreate}
                          className="w-full py-2.5 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition cursor-pointer"
                        >
                          Cancel &amp; Adjust Deposit Amount
                        </button>
                      </div>
                    )}

                    {pendingAsset === "ETH" ? (
                      <button
                        type="button"
                        disabled={directFunding || confirmingDeposit || isPendingOverBalance}
                        onClick={() => void executeDirectDeposit()}
                        className="w-full py-4 rounded-xl font-black text-sm bg-[var(--brand)] text-white hover:opacity-90 active:scale-[0.98] transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {directFunding || confirmingDeposit ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Depositing ETH on Base…</span>
                          </>
                        ) : (
                          <span>Deposit {exactDepositLabel} on Base</span>
                        )}
                      </button>
                    ) : checkingAllowance ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-4 rounded-xl font-bold text-sm bg-[var(--surface-2)] text-[var(--ink-muted)] flex items-center justify-center gap-2"
                      >
                        <Loader2 size={16} className="animate-spin" />
                        <span>Checking {pendingAsset} allowance…</span>
                      </button>
                    ) : usdcAllowanceError ? (
                      <button
                        type="button"
                        onClick={() => void refreshUsdcAllowance()}
                        className="w-full py-4 rounded-xl font-bold text-sm bg-amber-500/20 text-amber-600 border border-amber-500/30 cursor-pointer"
                      >
                        Could not read {pendingAsset} allowance · Tap to retry
                      </button>
                    ) : needsUsdcApproval ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={directApproving || isPendingOverBalance}
                          onClick={() => void executeDirectApprove()}
                          className="w-full py-4 rounded-xl font-black text-sm bg-[var(--brand)] text-white hover:opacity-90 active:scale-[0.98] transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {directApproving ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              <span>Approving {pendingAsset} in wallet…</span>
                            </>
                          ) : (
                            <span>Step 1/2 · Approve {exactDepositLabel}</span>
                          )}
                        </button>
                        <p className="text-[11px] text-center text-[var(--ink-muted)]">
                          Approve {pendingAsset} spending in your wallet, then complete deposit in Step 2.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={directFunding || confirmingDeposit || isPendingOverBalance}
                          onClick={() => void executeDirectDeposit()}
                          className="w-full py-4 rounded-xl font-black text-sm bg-[var(--brand)] text-white hover:opacity-90 active:scale-[0.98] transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {directFunding || confirmingDeposit ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              <span>Confirming {pendingAsset} deposit on Base…</span>
                            </>
                          ) : (
                            <span>Step 2/2 · Deposit {exactDepositLabel}</span>
                          )}
                        </button>
                        <p className="text-[11px] text-center text-[var(--ink-muted)]">
                          Deposit {pendingAsset} to fund batch #{pendingCards.batchId}. Secrets are stored securely.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          </StepSlide>
          </AnimatePresence>
        </div>

        {/* Right Sticky Live Card Preview (Col 8 to 12 on Desktop) */}
        <div className="hidden lg:block lg:col-span-5 sticky top-24">
          <div className="relative isolate overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-sm space-y-4">
            <div aria-hidden className="absolute -top-20 left-1/2 -z-10 h-48 w-72 -translate-x-1/2 rounded-full bg-[var(--brand)] opacity-15 blur-3xl" />
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--ink-soft)]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live preview
              </span>
              <span className="text-[11px] font-semibold text-[var(--ink-dim)]">What they&apos;ll receive</span>
            </div>

            {/* Gentle float, plus a small pop whenever the card's content changes */}
            <motion.div
              animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div
                key={`${asset}-${perCardWei ?? ""}-${cardTheme}`}
                initial={reduceMotion ? false : { scale: 0.96, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
              >
                <VoucherCardPreview
                  asset={asset}
                  amount={perCardWei ?? undefined}
                  message={message}
                  theme={cardTheme}
                />
              </motion.div>
            </motion.div>

            <p className="text-xs text-center text-[var(--ink-muted)]">
              Move your cursor over the card to tilt it. It updates as you go.
            </p>
          </div>
        </div>
      </div>

      {/* Asset Search & Select Modal for Stocks & Vaults */}
      <VoucherAssetPickerModal
        open={pickerModal.open}
        onClose={() => setPickerModal((prev) => ({ ...prev, open: false }))}
        category={pickerModal.category}
        selectedSymbol={asset}
        onSelect={(newAsset) => {
          setAsset(newAsset);
          setTotalAmount("1.0");
        }}
        userBalances={userBalances}
      />
    </div>
  );
}
