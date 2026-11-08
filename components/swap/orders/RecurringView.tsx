"use client";

import { useState, useMemo, useEffect } from "react";
import { formatUnits } from "viem";
import {
  ChevronDown,
  Loader2,
  Lock,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  PRICE_DECIMALS,
  parseDecimalInput,
  parseTriggerPrice,
  expectedAmountOut,
  dcaTotal,
  validateDca,
} from "@/src/lib/limitOrders/orderMath";
import type { useLimitOrders, MarketState } from "@/src/lib/limitOrders/useLimitOrders";
import MyPlansPanel from "./MyPlansPanel";

const INTERVAL_PRESETS = [
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86400 },
  { label: "1 week", seconds: 604800 },
];

interface RecurringViewProps {
  limitOrders: ReturnType<typeof useLimitOrders>;
  onConnectWallet?: () => void;
  onSwitchChain?: () => void;
}

export default function RecurringView({
  limitOrders,
  onConnectWallet,
  onSwitchChain,
}: RecurringViewProps) {
  const {
    config,
    chainId,
    walletAddress,
    paused,
    quoteBalance,
    quoteAllowance,
    marketStates,
    plans,
    regionRestricted,
    txSubmitting,
    txSuccessHash,
    approveToken,
    createDca,
    cancelDca,
  } = limitOrders;

  const [selectedStock, setSelectedStock] = useState<string>(
    config.markets[0]?.stockToken.toLowerCase() || ""
  );
  const [amountPerBuyInput, setAmountPerBuyInput] = useState("");
  const [buysCount, setBuysCount] = useState(5);
  const [intervalSec, setIntervalSec] = useState(86400); // 1 day
  const [customIntervalHours, setCustomIntervalHours] = useState("");
  const [priceCeilingInput, setPriceCeilingInput] = useState("");

  // Keep selectedStock valid across chain switches (e.g. Sepolia vs Mainnet)
  useEffect(() => {
    const current = config.markets.find(
      (m) => m.stockToken.toLowerCase() === selectedStock.toLowerCase()
    );
    if (!current && config.markets.length > 0) {
      setSelectedStock(config.markets[0].stockToken.toLowerCase());
    }
  }, [config.markets, selectedStock]);

  const activeMarket: MarketState | undefined = marketStates[selectedStock];
  const stockSymbol = activeMarket?.symbol || "Stock";
  const stockDecimals = activeMarket?.decimals || 8;
  const quoteSymbol = config.quoteToken.symbol;
  const quoteDecimals = config.quoteToken.decimals;
  const currentPrice = activeMarket?.currentPrice || null;

  // Active interval calculation
  const activeInterval = useMemo(() => {
    if (customIntervalHours.trim() !== "") {
      const h = parseFloat(customIntervalHours);
      return Number.isFinite(h) && h >= 1 ? Math.round(h * 3600) : 3600;
    }
    return intervalSec;
  }, [customIntervalHours, intervalSec]);

  // Amount parsing
  const parsedAmountPerBuy = useMemo(
    () => parseDecimalInput(amountPerBuyInput, quoteDecimals),
    [amountPerBuyInput, quoteDecimals]
  );

  // Price ceiling parsing
  const parsedPriceCeiling = useMemo(
    () => (priceCeilingInput.trim() === "" ? null : parseTriggerPrice(priceCeilingInput)),
    [priceCeilingInput]
  );

  // Total budget
  const totalBudget = useMemo(() => {
    if (!parsedAmountPerBuy) return 0n;
    return dcaTotal(parsedAmountPerBuy, buysCount);
  }, [parsedAmountPerBuy, buysCount]);

  // Estimated stock receive per buy
  const estStockPerBuy = useMemo(() => {
    if (!parsedAmountPerBuy || !currentPrice) return 0n;
    return expectedAmountOut("LIMIT_BUY", parsedAmountPerBuy, currentPrice, stockDecimals, quoteDecimals);
  }, [parsedAmountPerBuy, currentPrice, stockDecimals, quoteDecimals]);

  // Max quote cap
  const maxQuoteCap = activeMarket?.maxQuoteIn || config.maxQuoteIn;

  // Validation
  const validationError = useMemo(() => {
    return validateDca({
      amountPerBuy: parsedAmountPerBuy,
      buys: buysCount,
      intervalSec: activeInterval,
      maxPrice: parsedPriceCeiling,
      balance: quoteBalance,
      maxQuoteIn: maxQuoteCap,
    });
  }, [parsedAmountPerBuy, buysCount, activeInterval, parsedPriceCeiling, quoteBalance, maxQuoteCap]);

  // Allowance check on TOTAL budget
  const needsApproval = useMemo(() => {
    if (totalBudget <= 0n) return false;
    return quoteAllowance < totalBudget;
  }, [totalBudget, quoteAllowance]);

  const handleApproveTotal = async () => {
    if (totalBudget <= 0n) return;
    await approveToken(config.quoteToken.address, totalBudget, quoteSymbol);
  };

  const handleStartDca = async () => {
    if (validationError || !parsedAmountPerBuy || !activeMarket) return;
    const maxPriceVal = parsedPriceCeiling !== null ? parsedPriceCeiling : 0n;
    const hash = await createDca({
      stockToken: activeMarket.stockToken,
      amountPerBuy: parsedAmountPerBuy,
      buys: buysCount,
      interval: activeInterval,
      maxPrice: maxPriceVal,
    });
    if (hash) {
      setAmountPerBuyInput("");
      setPriceCeilingInput("");
    }
  };

  const isWrongChain = chainId !== 8453 && chainId !== 84532;

  const intervalLabel = useMemo(() => {
    if (activeInterval === 3600) return "hour";
    if (activeInterval === 86400) return "day";
    if (activeInterval === 604800) return "week";
    return `${Math.round(activeInterval / 3600)} hours`;
  }, [activeInterval]);

  return (
    <div className="space-y-4">
      {/* Alert banners */}
      <div className="flex items-center justify-between text-xs px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-cyan-600 text-white uppercase tracking-wider">
            DCA Automation
          </span>
          <span className="text-[var(--ink-muted)]">
            Recurring accumulation with optional price protection
          </span>
        </div>
      </div>

      {paused && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
          <Lock size={15} className="shrink-0" />
          <span>
            Orders are paused right now. Creating plans is disabled, but you can still cancel existing plans.
          </span>
        </div>
      )}

      {regionRestricted && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
          <AlertTriangle size={15} className="shrink-0" />
          <span>
            {"These orders aren't available in your region. You can still cancel existing plans and withdraw."}
          </span>
        </div>
      )}

      {/* Main Recurring Form Card */}
      <div className="p-4 sm:p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-card space-y-4">
        {/* Stock Selector & Live Price */}
        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <label
              htmlFor="recurring-stock-select"
              className="block text-[10px] text-[var(--ink-muted)] uppercase tracking-wider mb-0.5"
            >
              Accumulate Stock
            </label>
            <div className="relative">
              <select
                id="recurring-stock-select"
                aria-label="Accumulate Stock"
                value={selectedStock}
                onChange={(e) => setSelectedStock(e.target.value)}
                className="w-full bg-transparent text-sm font-bold text-[var(--ink)] focus:outline-hidden cursor-pointer appearance-none pr-6"
              >
                {config.markets.map((m) => (
                  <option
                    key={m.stockToken}
                    value={m.stockToken.toLowerCase()}
                    className="bg-[var(--surface)] text-[var(--ink)]"
                  >
                    {m.symbol} &middot; {m.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none"
              />
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="block text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">
              Market Price
            </span>
            <span className="text-sm font-mono font-bold text-[var(--ink)] tabular-nums">
              {currentPrice !== null ? `$${formatUnits(currentPrice, PRICE_DECIMALS)}` : "—"}
            </span>
          </div>
        </div>

        {/* Amount per buy */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="amount-per-buy-input"
              className="text-xs font-semibold text-[var(--ink)]"
            >
              Amount per Buy (USDC)
            </label>
            <span className="text-xs text-[var(--ink-muted)]">
              Available: {formatUnits(quoteBalance, quoteDecimals)} {quoteSymbol}
            </span>
          </div>
          <div className="relative">
            <input
              id="amount-per-buy-input"
              type="text"
              value={amountPerBuyInput}
              onChange={(e) => setAmountPerBuyInput(e.target.value)}
              placeholder="e.g. 50"
              className="w-full px-3.5 py-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] font-mono text-base focus:outline-hidden focus:ring-2 focus:ring-[var(--brand)]"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--ink-muted)] pointer-events-none">
              USDC
            </span>
          </div>
        </div>

        {/* Number of Buys & Interval Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Number of buys */}
          <div className="space-y-1">
            <label
              htmlFor="number-of-buys-input"
              className="block text-[10px] text-[var(--ink-muted)] uppercase tracking-wider"
            >
              Number of Buys (1-365)
            </label>
            <input
              id="number-of-buys-input"
              type="number"
              min="1"
              max="365"
              value={buysCount}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isFinite(n)) setBuysCount(n);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] font-mono text-sm"
            />
          </div>

          {/* Interval */}
          <div className="space-y-1">
            <label className="block text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">
              Repeat Frequency
            </label>
            <div className="flex items-center gap-1">
              {INTERVAL_PRESETS.map((p) => (
                <button
                  key={p.seconds}
                  type="button"
                  onClick={() => {
                    setIntervalSec(p.seconds);
                    setCustomIntervalHours("");
                  }}
                  className={`flex-1 text-[10px] font-bold py-2 min-h-[44px] flex items-center justify-center rounded-md border ${
                    intervalSec === p.seconds && customIntervalHours === ""
                      ? "bg-[#0052FF] text-white border-[#0052FF]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Optional Price Ceiling */}
        <div className="space-y-1 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <label
              htmlFor="price-ceiling-input"
              className="text-xs font-semibold text-[var(--ink)]"
            >
              Optional Price Ceiling (USD)
            </label>
            <span className="text-[10px] text-[var(--ink-muted)]">Optional</span>
          </div>
          <input
            id="price-ceiling-input"
            type="text"
            value={priceCeilingInput}
            onChange={(e) => setPriceCeilingInput(e.target.value)}
            placeholder="Skip buys while price is above this"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] font-mono text-sm"
          />
          <p className="text-[11px] text-[var(--ink-muted)]">
            If market price exceeds this ceiling when a buy is due, the buy is skipped automatically.
          </p>
        </div>

        {/* Schedule Summary & Budget Card */}
        <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[var(--ink-muted)]">Total Escrow Budget:</span>
            <span className="font-bold text-[var(--ink)] tabular-nums text-sm">
              {formatUnits(totalBudget, quoteDecimals)} {quoteSymbol}
            </span>
          </div>

          <div className="flex items-center justify-between text-[var(--ink-muted)]">
            <span>Schedule Summary:</span>
            <span className="font-semibold text-[var(--ink)]">
              {buysCount} buys of {amountPerBuyInput || "0"} USDC, one per {intervalLabel}
            </span>
          </div>

          <div className="flex items-center justify-between text-[var(--ink-muted)]">
            <span>Est. Stock per Buy:</span>
            <span className="font-semibold text-[var(--ink)] tabular-nums">
              {estStockPerBuy > 0n
                ? `~${formatUnits(estStockPerBuy, stockDecimals)} ${stockSymbol}`
                : "—"}
            </span>
          </div>

          <div className="pt-1 border-t border-[var(--border-subtle)] text-[10px] text-[var(--ink-muted)] space-y-0.5">
            <p>&bull; The first buy runs as soon as the keeper picks it up.</p>
            <p>&bull; Trailing stops and DCA depend on the keeper running.</p>
            <p>&bull; Plan beta cap: {formatUnits(maxQuoteCap, quoteDecimals)} {quoteSymbol}</p>
          </div>
        </div>

        {/* Validation Error Feedback */}
        {validationError && amountPerBuyInput.trim() !== "" && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Submit Actions */}
        <div>
          {!walletAddress ? (
            <button
              type="button"
              onClick={onConnectWallet}
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-[#0052FF] text-white font-bold text-sm hover:bg-[#0045D8] transition shadow-xs flex items-center justify-center"
            >
              Connect Wallet
            </button>
          ) : isWrongChain ? (
            <button
              type="button"
              onClick={onSwitchChain}
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition flex items-center justify-center"
            >
              Switch to Base
            </button>
          ) : regionRestricted ? (
            <button
              type="button"
              disabled
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-[var(--surface-2)] text-[var(--ink-muted)] font-bold text-sm cursor-not-allowed border border-[var(--border-subtle)] flex items-center justify-center"
            >
              {"These orders aren't available in your region"}
            </button>
          ) : paused ? (
            <button
              type="button"
              disabled
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-[var(--surface-2)] text-[var(--ink-muted)] font-bold text-sm cursor-not-allowed border border-[var(--border-subtle)] flex items-center justify-center"
            >
              Orders Paused
            </button>
          ) : needsApproval ? (
            <button
              type="button"
              onClick={handleApproveTotal}
              disabled={txSubmitting}
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-[#0052FF] text-white font-bold text-sm hover:bg-[#0045D8] transition flex items-center justify-center gap-2"
            >
              {txSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Approving {quoteSymbol} Budget…</span>
                </>
              ) : (
                `Approve ${formatUnits(totalBudget, quoteDecimals)} ${quoteSymbol}`
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartDca}
              disabled={Boolean(validationError) || txSubmitting}
              className="w-full py-3.5 min-h-[44px] rounded-xl bg-[#0052FF] text-white font-bold text-sm hover:bg-[#0045D8] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none shadow-xs"
            >
              {txSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Starting Recurring Plan…</span>
                </>
              ) : (
                "Start Recurring Buy Plan"
              )}
            </button>
          )}
        </div>

        {/* Transaction Success */}
        {txSuccessHash && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={14} /> Plan created successfully!
            </span>
            <a
              href={`https://${chainId === 84532 ? "sepolia." : ""}basescan.org/tx/${txSuccessHash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-bold underline hover:opacity-80"
            >
              Basescan <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>

      {/* "My plans" Panel */}
      <MyPlansPanel
        plans={plans}
        markets={marketStates}
        quoteSymbol={quoteSymbol}
        quoteDecimals={quoteDecimals}
        onCancelPlan={cancelDca}
        isSubmitting={txSubmitting}
      />
    </div>
  );
}
