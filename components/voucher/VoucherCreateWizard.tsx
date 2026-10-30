"use client";

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  TrendingUp,
  Coins,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Info,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Minus,
  Plus,
  Loader2,
} from "lucide-react";
import { Transaction, TransactionButton } from "@coinbase/onchainkit/transaction";
import { base } from "viem/chains";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";
import {
  MAX_VOUCHER_CARDS,
  formatSplitSummary,
  formatVoucherAmount,
  isStockAsset,
  isVaultShareAsset,
  getVaultShareBySymbol,
} from "@/lib/utils/voucher";
import { getBaseStockBySymbol } from "@/lib/stocks/base-stocks";
import {
  OCCASION_TEMPLATES,
  CARD_THEME_OPTIONS,
  QUICK_CARD_PRESETS,
} from "./voucher-constants";
import type { CardTheme, VoucherAssetCategory } from "./voucher-types";
import VoucherCardPreview from "./VoucherCardPreview";
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
  const { contractReady, address, txCaps, prepareOnchainKitCalls } = shared;
  const {
    asset,
    setAsset,
    totalAmount,
    setTotalAmount,
    cardCountInput,
    setCardCountInput,
    message,
    setMessage,
    creating,
    pendingCards,
    split,
    perCardWei,
    cardCount,
    prepareCreate,
    cancelPendingCreate,
    pendingAsset,
    exactDepositLabel,
    needsUsdcApproval,
    confirmingDeposit,
    createEthCall,
    approveUsdcCall,
    createUsdcCall,
    checkingAllowance,
    usdcAllowanceError,
    usdcReadyToFund,
    usdcTxKey,
    refreshUsdcAllowance,
    handleApproveTx,
    handleFundTx,
    directApproving,
    directFunding,
    executeDirectApprove,
    executeDirectDeposit,
  } = create;

  // Wizard step state (1 to 4)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

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
  const estimatedUsdValue = useMemo(() => {
    const num = parseFloat(totalAmount);
    if (!Number.isFinite(num) || num <= 0) return null;
    if (asset === "USDC") return `$${num.toFixed(2)}`;
    if (asset === "ETH") return `~$${(num * 2600).toFixed(2)}`;
    if (isStock) return `~$${(num * 150).toFixed(2)}`;
    if (isVault) return `~$${(num * 100).toFixed(2)}`;
    return null;
  }, [totalAmount, asset, isStock, isVault]);

  // Card count adjustments
  const incrementCardCount = () => {
    const next = Math.min(MAX_VOUCHER_CARDS, Math.max(1, (parseInt(cardCountInput, 10) || 1) + 1));
    setCardCountInput(String(next));
  };

  const decrementCardCount = () => {
    const next = Math.max(1, (parseInt(cardCountInput, 10) || 1) - 1);
    setCardCountInput(String(next));
  };

  // If pendingCards is active, force step 4 (Review & Fund)
  React.useEffect(() => {
    if (pendingCards) {
      setCurrentStep(4);
    }
  }, [pendingCards]);

  return (
    <div className="space-y-6">
      {/* 4-Step Progress Indicator */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 sm:p-4 shadow-sm">
        <div className="grid grid-cols-4 gap-2">
          {[
            { step: 1, title: "1. Asset", desc: asset },
            { step: 2, title: "2. Amount", desc: `${cardCountInput || 1} cards` },
            { step: 3, title: "3. Personalize", desc: cardTheme },
            { step: 4, title: "4. Review", desc: "Confirm & create" },
          ].map((s) => {
            const isActive = currentStep === s.step;
            const isCompleted = currentStep > s.step;
            return (
              <button
                key={s.step}
                type="button"
                disabled={!!pendingCards && s.step < 4}
                onClick={() => setCurrentStep(s.step as 1 | 2 | 3 | 4)}
                className={`flex flex-col items-center sm:items-start text-center sm:text-left p-2 sm:px-3 sm:py-2.5 rounded-xl transition ${
                  isActive
                    ? "bg-[var(--brand-soft)] border border-[var(--brand)]/40 text-[var(--brand-text)]"
                    : isCompleted
                      ? "bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--border-subtle)]/40 cursor-pointer"
                      : "opacity-60 text-[var(--ink-muted)] cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-1.5 font-black text-xs">
                  {isCompleted ? (
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  ) : null}
                  <span>{s.title}</span>
                </div>
                <span className="text-[10px] text-[var(--ink-muted)] truncate hidden sm:block mt-0.5">
                  {s.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

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
        <div className="lg:col-span-7 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-7 shadow-sm space-y-6">
          {/* STEP 1: ASSET SELECTION */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-text)]">
                  Step 1 of 4
                </span>
                <h2 className="text-xl font-black text-[var(--ink)] mt-0.5">
                  Choose gift asset
                </h2>
                <p className="text-xs text-[var(--ink-muted)] mt-1">
                  Select stablecoins, ETH, tokenized equities, or yield-bearing vaults.
                </p>
              </div>

              {/* Segmented Category Control */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "usdc", label: "USDC", icon: "$" },
                  { id: "eth", label: "ETH", icon: "Ξ" },
                  { id: "stock", label: "Stocks", icon: "📈" },
                  { id: "vault", label: "Vaults", icon: "⚡" },
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
                      className={`pop-pill flex items-center justify-center gap-2 py-3 px-2 rounded-xl font-bold text-xs sm:text-sm border transition cursor-pointer ${
                        isSelected
                          ? "bg-[#0052FF] text-white border-[#0052FF] shadow-xs"
                          : "bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Asset Info Banner */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TokenLogo
                    address={stockInfo?.address || (asset === "USDC" ? "0x833589fCD6eDb6E08f4c7C32D4f71bdA02913" : asset === "ETH" ? "eth" : undefined)}
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
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-text)]">
                  Step 2 of 4
                </span>
                <h2 className="text-xl font-black text-[var(--ink)] mt-0.5">
                  Amount & card split
                </h2>
                <p className="text-xs text-[var(--ink-muted)] mt-1">
                  Specify total deposit and how many equal gift cards to create (1 to 50).
                </p>
              </div>

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
                    className="w-full text-lg sm:text-xl font-black rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--brand-text)] transition tabular-nums"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-sm text-[var(--ink-muted)]">
                    {asset}
                  </span>
                </div>
                {estimatedUsdValue && (
                  <p className="text-xs text-[var(--ink-muted)] mt-1.5 pl-1 tabular-nums">
                    ≈ {estimatedUsdValue} USD value
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
                      className={`pop-pill flex-1 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        cardCountInput === String(p)
                          ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                          : "bg-[var(--surface-2)] text-[var(--ink-muted)] border-[var(--border-subtle)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {p} {p === 1 ? "Card" : "Cards"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compact Split Breakdown Line */}
              {split && (
                <div
                  className={`rounded-xl p-3 border text-xs flex items-center justify-between ${
                    split.valid
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
                  disabled={!perCardWei}
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
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-text)]">
                  Step 3 of 4
                </span>
                <h2 className="text-xl font-black text-[var(--ink)] mt-0.5">
                  Personalize card
                </h2>
                <p className="text-xs text-[var(--ink-muted)] mt-1">
                  Choose an occasion template and card theme. Templates only affect message and theme.
                </p>
              </div>

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
                      className="pop-pill flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-left hover:border-[var(--brand)]/50 transition cursor-pointer"
                    >
                      <span className="text-lg">{tmpl.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[var(--ink)] truncate">
                          {tmpl.label}
                        </p>
                        <p className="text-[10px] text-[var(--ink-muted)] truncate">
                          {tmpl.theme}
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
                        className={`pop-pill flex items-center gap-2 p-2.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? "border-[var(--brand-text)] bg-[var(--brand-soft)] text-[var(--brand-text)]"
                            : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)]"
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 border border-white/20"
                          style={{ background: themeOpt.accentColor }}
                        />
                        <span className="text-xs font-black truncate">{themeOpt.label}</span>
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
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-text)]">
                  Step 4 of 4
                </span>
                <h2 className="text-xl font-black text-[var(--ink)] mt-0.5">
                  Review & deposit
                </h2>
                <p className="text-xs text-[var(--ink-muted)] mt-1">
                  Verify batch parameters and confirm your deposit on Base.
                </p>
              </div>

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
              <div className="pop rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-2.5 text-xs">
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
                    <button
                      type="button"
                      disabled={!contractReady || creating || !perCardWei}
                      onClick={prepareCreate}
                      className="w-full py-4 rounded-xl font-black text-sm bg-[var(--brand)] text-white hover:opacity-90 disabled:opacity-40 active:scale-[0.98] transition cursor-pointer shadow-md"
                    >
                      {creating ? "Generating Card Secrets…" : "Create Gift Cards"}
                    </button>
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

                    {pendingAsset === "ETH" ? (
                      <button
                        type="button"
                        disabled={directFunding || confirmingDeposit}
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
                          disabled={directApproving}
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
                          disabled={directFunding || confirmingDeposit}
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
        </div>

        {/* Right Sticky Live Card Preview (Col 8 to 12 on Desktop) */}
        <div className="hidden lg:block lg:col-span-5 sticky top-24">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ink-muted)]">
                Live Card Preview
              </span>
              <span className="text-[10px] font-bold text-[var(--brand-text)] bg-[var(--brand-soft)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full">
                Interactive 3D
              </span>
            </div>

            <VoucherCardPreview
              asset={asset}
              amount={perCardWei ?? undefined}
              message={message}
              theme={cardTheme}
            />

            <p className="text-[11px] text-center text-[var(--ink-muted)]">
              Hover to view subtle 3D tilt. This is exactly what recipients will see.
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
