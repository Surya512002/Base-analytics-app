// Pure helpers for limit / stop-loss orders. No React, no network. Shared by the UI and the keeper.
import { parseUnits } from "viem";

export const PRICE_DECIMALS = 8; // contract price precision (USD per 1 whole stock token)
export const BPS = 10_000n;

export type OrderKind = "LIMIT_BUY" | "LIMIT_SELL" | "STOP_LOSS" | "TRAILING_STOP";
export const ORDER_TYPE_INDEX: Record<OrderKind, number> = { LIMIT_BUY: 0, LIMIT_SELL: 1, STOP_LOSS: 2, TRAILING_STOP: 3 };
/** User-facing names. LIMIT_SELL is the "take-profit" order. */
export const ORDER_LABEL: Record<OrderKind, string> = {
  LIMIT_BUY: "Limit buy", LIMIT_SELL: "Take-profit", STOP_LOSS: "Stop-loss", TRAILING_STOP: "Trailing stop",
};

// Mirrors of contract constants (keep in sync with LimitOrderBook.sol)
export const MIN_TRAIL_BPS = 50;
export const MAX_TRAIL_BPS = 5000;
export const MIN_DCA_INTERVAL_SEC = 3600;
export const MAX_DCA_BUYS = 365;
export const MAX_DURATION_SEC = 90 * 86400;
export const ORDER_STATUS = ["NONE", "OPEN", "EXECUTED", "CANCELLED", "EXPIRED"] as const;

const MAX_UINT96 = (1n << 96n) - 1n;
const MAX_UINT128 = (1n << 128n) - 1n;

/** Parse a user-typed decimal string ("123.45") into a bigint with `decimals`. Returns null if invalid/zero/negative. */
export function parseDecimalInput(input: string, decimals: number): bigint | null {
  const s = input.trim();
  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return null;
  const [, frac = ""] = s.split(".");
  if (frac.length > decimals) return null; // never silently round user money
  try {
    const v = parseUnits(s, decimals);
    return v > 0n ? v : null;
  } catch {
    return null;
  }
}

/** USD price string -> 8-decimal bigint for the contract. */
export function parseTriggerPrice(input: string): bigint | null {
  const v = parseDecimalInput(input, PRICE_DECIMALS);
  return v !== null && v <= MAX_UINT96 ? v : null;
}

/**
 * Expected output (gross, before keeper fee) if the swap executes exactly at the trigger price.
 *  - LIMIT_BUY: amountIn is quote units (e.g. USDC), output is stock units.
 *  - LIMIT_SELL / STOP_LOSS: amountIn is stock units, output is quote units.
 */
export function expectedAmountOut(
  kind: OrderKind,
  amountIn: bigint,
  trigger: bigint,
  stockDecimals: number,
  quoteDecimals: number,
): bigint {
  if (amountIn <= 0n || trigger <= 0n) return 0n;
  const pow = (n: number) => 10n ** BigInt(n);
  if (kind === "LIMIT_BUY") {
    return (amountIn * pow(PRICE_DECIMALS) * pow(stockDecimals)) / (trigger * pow(quoteDecimals));
  }
  return (amountIn * trigger * pow(quoteDecimals)) / (pow(stockDecimals) * pow(PRICE_DECIMALS));
}

/**
 * Minimum the owner must receive AFTER the keeper fee. The contract reverts below this.
 * slippageBps must be larger than the keeper fee or the order could never execute.
 */
export function minAmountOut(expected: bigint, slippageBps: number): bigint {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps >= 10_000) throw new Error("bad slippage");
  return (expected * (BPS - BigInt(slippageBps))) / BPS;
}

export type ValidationInput = {
  kind: Exclude<OrderKind, "TRAILING_STOP">;
  amountIn: bigint | null;
  trigger: bigint | null;
  currentPrice: bigint | null; // 8 decimals, from contract currentPrice()
  slippageBps: number;
  keeperFeeBps: number;
  balance: bigint;
  maxAmountIn: bigint; // per-order cap for the input token
  expiry: number; // unix seconds
  nowSec: number;
};

/** Returns a human-readable error, or null when the order is valid to submit. Mirrors the contract checks. */
export function validateOrder(v: ValidationInput): string | null {
  if (v.amountIn === null) return "Enter an amount.";
  if (v.trigger === null) return "Enter a trigger price.";
  if (v.amountIn > MAX_UINT128) return "Amount is too large.";
  if (v.amountIn > v.balance) return "Amount is more than your balance.";
  if (v.amountIn > v.maxAmountIn) return "Amount is above the per-order limit during beta.";
  if (v.slippageBps <= v.keeperFeeBps) return "Slippage must be higher than the keeper fee.";
  if (v.expiry <= v.nowSec) return "Pick an expiry in the future.";
  if (v.expiry > v.nowSec + 90 * 86400) return "Expiry can be at most 90 days away.";
  if (v.currentPrice !== null) {
    const triggersNow = v.kind === "LIMIT_SELL" ? v.currentPrice >= v.trigger : v.currentPrice <= v.trigger;
    if (triggersNow) {
      return v.kind === "LIMIT_SELL"
        ? "Trigger must be above the current price."
        : "Trigger must be below the current price.";
    }
  }
  return null;
}

/** Stop level of a trailing stop: `trailBps` below the peak. Mirrors the contract. */
export function trailingStopPrice(peak: bigint, trailBps: number): bigint {
  return (peak * (BPS - BigInt(trailBps))) / BPS;
}

/**
 * Lowest gross output the contract will accept for a fill (oracle-bounded fill guard).
 * Use it to show users the worst case: "you will receive at least X".
 */
export function fillFloor(
  kind: OrderKind,
  amountIn: bigint,
  oraclePrice: bigint,
  stockDecimals: number,
  quoteDecimals: number,
  maxDeviationBps: number,
): bigint {
  const ideal = expectedAmountOut(kind, amountIn, oraclePrice, stockDecimals, quoteDecimals);
  return (ideal * (BPS - BigInt(maxDeviationBps))) / BPS;
}

type CommonSell = {
  amountIn: bigint | null;
  slippageBps: number;
  keeperFeeBps: number;
  balance: bigint;
  maxAmountIn: bigint;
  expiry: number;
  nowSec: number;
};

function commonSellError(v: CommonSell): string | null {
  if (v.amountIn === null) return "Enter an amount.";
  if (v.amountIn > MAX_UINT128) return "Amount is too large.";
  if (v.amountIn > v.balance) return "Amount is more than your balance.";
  if (v.amountIn > v.maxAmountIn) return "Amount is above the per-order limit during beta.";
  if (v.slippageBps <= v.keeperFeeBps) return "Slippage must be higher than the keeper fee.";
  if (v.expiry <= v.nowSec) return "Pick an expiry in the future.";
  if (v.expiry > v.nowSec + MAX_DURATION_SEC) return "Expiry can be at most 90 days away.";
  return null;
}

/** Trailing stop: trail between 0.5% and 50%. */
export function validateTrailing(v: CommonSell & { trailBps: number }): string | null {
  const c = commonSellError(v);
  if (c) return c;
  if (!Number.isInteger(v.trailBps) || v.trailBps < MIN_TRAIL_BPS || v.trailBps > MAX_TRAIL_BPS) {
    return "Trailing distance must be between 0.5% and 50%.";
  }
  return null;
}

/** Bracket (take-profit + stop-loss): stop below the current price, take-profit above it. */
export function validateBracket(
  v: CommonSell & { takeProfit: bigint | null; stopLoss: bigint | null; currentPrice: bigint | null },
): string | null {
  if (v.takeProfit === null) return "Enter a take-profit price.";
  if (v.stopLoss === null) return "Enter a stop-loss price.";
  if (v.stopLoss >= v.takeProfit) return "Stop-loss must be below take-profit.";
  if (v.currentPrice !== null) {
    if (v.takeProfit <= v.currentPrice) return "Take-profit must be above the current price.";
    if (v.stopLoss >= v.currentPrice) return "Stop-loss must be below the current price.";
  }
  return commonSellError(v);
}

/** Total quote token a DCA plan locks up. */
export function dcaTotal(amountPerBuy: bigint, buys: number): bigint {
  return amountPerBuy * BigInt(buys);
}

/** Recurring buys: 1..365 buys, at least 1 hour apart, total within the market cap. */
export function validateDca(v: {
  amountPerBuy: bigint | null;
  buys: number;
  intervalSec: number;
  maxPrice: bigint | null; // null = no ceiling
  balance: bigint;
  maxQuoteIn: bigint;
}): string | null {
  if (v.amountPerBuy === null) return "Enter an amount per buy.";
  if (!Number.isInteger(v.buys) || v.buys < 1 || v.buys > MAX_DCA_BUYS) return "Number of buys must be between 1 and 365.";
  if (!Number.isInteger(v.intervalSec) || v.intervalSec < MIN_DCA_INTERVAL_SEC) return "Buys must be at least 1 hour apart.";
  const total = dcaTotal(v.amountPerBuy, v.buys);
  if (total > v.balance) return "Total is more than your balance.";
  if (total > v.maxQuoteIn) return "Total is above the per-plan limit during beta.";
  if (v.maxPrice !== null && v.maxPrice > MAX_UINT96) return "Price ceiling is too large.";
  return null;
}
