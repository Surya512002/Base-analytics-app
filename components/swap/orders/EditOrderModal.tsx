"use client";

import { useState, useMemo } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { formatUnits } from "viem";
import type { OnChainOrder } from "@/src/lib/limitOrders/types";
import {
  parseTriggerPrice,
  parseDecimalInput,
  expectedAmountOut,
  minAmountOut,
  PRICE_DECIMALS,
  type OrderKind,
} from "@/src/lib/limitOrders/orderMath";
import type { MarketState } from "@/src/lib/limitOrders/useLimitOrders";

interface EditOrderModalProps {
  order: OnChainOrder;
  market?: MarketState;
  quoteDecimals: number;
  onClose: () => void;
  onSave: (id: bigint, newTrigger: bigint, newMinOut: bigint) => Promise<boolean>;
}

export default function EditOrderModal({
  order,
  market,
  quoteDecimals,
  onClose,
  onSave,
}: EditOrderModalProps) {
  const stockDecimals = market?.decimals || 8;
  const currentPrice = market?.currentPrice || null;

  const initialTriggerStr = formatUnits(order.triggerPrice, PRICE_DECIMALS);
  const outDecimals = order.orderType === 0 ? stockDecimals : quoteDecimals;
  const initialMinOutStr = formatUnits(order.minAmountOut, outDecimals);

  const [triggerInput, setTriggerInput] = useState(initialTriggerStr);
  const [minOutInput, setMinOutInput] = useState(initialMinOutStr);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const kind: OrderKind =
    order.orderType === 0
      ? "LIMIT_BUY"
      : order.orderType === 1
        ? "LIMIT_SELL"
        : "STOP_LOSS";

  const parsedTrigger = useMemo(() => parseTriggerPrice(triggerInput), [triggerInput]);
  const parsedMinOut = useMemo(
    () => parseDecimalInput(minOutInput, outDecimals),
    [minOutInput, outDecimals]
  );

  // Auto-estimate minimum output when trigger changes if user wants quick recalculation
  const expectedOut = useMemo(() => {
    if (!parsedTrigger) return 0n;
    return expectedAmountOut(kind, order.amountIn, parsedTrigger, stockDecimals, quoteDecimals);
  }, [kind, order.amountIn, parsedTrigger, stockDecimals, quoteDecimals]);

  const validationError = useMemo(() => {
    if (!parsedTrigger) return "Enter a valid trigger price in USD.";
    if (!parsedMinOut) return "Enter a valid minimum output amount.";

    if (currentPrice !== null) {
      const triggersNow =
        kind === "LIMIT_SELL" ? currentPrice >= parsedTrigger : currentPrice <= parsedTrigger;
      if (triggersNow) {
        return kind === "LIMIT_SELL"
          ? "Take-profit trigger must be above the current price."
          : "Trigger must be below the current price.";
      }
    }
    return null;
  }, [parsedTrigger, parsedMinOut, currentPrice, kind]);

  const handleApplySlippage = (slippagePercent: number) => {
    if (expectedOut <= 0n) return;
    const bps = Math.round(slippagePercent * 100);
    const calculated = minAmountOut(expectedOut, bps);
    setMinOutInput(formatUnits(calculated, outDecimals));
  };

  const handleSave = async () => {
    if (validationError || !parsedTrigger || !parsedMinOut) return;
    try {
      setSaving(true);
      setErrorMsg(null);
      const ok = await onSave(order.id, parsedTrigger, parsedMinOut);
      if (ok) {
        onClose();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-[420px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--ink)]">
            Edit Order #{order.id.toString()}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Current Price Reference */}
          {currentPrice && (
            <div className="flex items-center justify-between text-xs text-[var(--ink-muted)] px-3 py-2 rounded-xl bg-[var(--surface-2)]">
              <span>Market Price</span>
              <span className="font-semibold text-[var(--ink)] tabular-nums">
                ${formatUnits(currentPrice, PRICE_DECIMALS)}
              </span>
            </div>
          )}

          {/* Trigger Price */}
          <div>
            <label
              htmlFor="edit-trigger-price"
              className="block text-xs font-medium text-[var(--ink-muted)] mb-1"
            >
              New Trigger Price (USD)
            </label>
            <input
              id="edit-trigger-price"
              type="text"
              value={triggerInput}
              onChange={(e) => setTriggerInput(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>

          {/* Minimum Output */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="edit-min-out"
                className="text-xs font-medium text-[var(--ink-muted)]"
              >
                Minimum Receive
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleApplySlippage(1)}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--border-subtle)]"
                >
                  1% slip
                </button>
                <button
                  type="button"
                  onClick={() => handleApplySlippage(2)}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--border-subtle)]"
                >
                  2% slip
                </button>
              </div>
            </div>
            <input
              id="edit-min-out"
              type="text"
              value={minOutInput}
              onChange={(e) => setMinOutInput(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>

          {/* Validation Feedback */}
          {validationError && (
            <div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 px-3 py-2 rounded-xl">
              <AlertCircle size={14} className="shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-1.5 text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-xl">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-3)] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={Boolean(validationError) || saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#0052FF] text-white text-xs font-semibold hover:bg-[#0045D8] transition disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
