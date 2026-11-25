// Pure maths for a multi-stock recurring-buy plan ("basket plan"). No React, no network.
//
// A basket plan is just one ordinary on-chain recurring buy (createDca) per stock, sized from a total
// budget and the weights. Nothing here changes what the contract allows: each plan keeps the
// contract's own limits (1 to 365 buys, at least 1 hour apart, total within the per-plan cap).
import { MAX_DCA_BUYS, MIN_DCA_INTERVAL_SEC, PRICE_DECIMALS } from "./orderMath";

export const MAX_BASKET_STOCKS = 10;
/** Smallest buy per run we accept: below this the pool fee and price impact eat too much of it. */
export const MIN_BUY_USDC = 1_000_000n; // $1 with 6 decimals
/** Below this per-run amount we still allow the plan but warn about fees. */
export const SOFT_MIN_BUY_USDC = 5_000_000n; // $5

export interface ComposerStock {
  symbol: string;
  stockToken: `0x${string}`;
  /** Share of the budget in percent (two decimals at most). */
  weightPct: number;
  /** The market's per-plan cap from the contract (quote units). */
  maxQuoteIn: bigint;
}

/** Part of each stock's budget that only buys after a drop: its own plan with a lower price ceiling. */
export interface DipOption {
  /** Percent of the budget kept for dips (10 to 90). */
  sharePct: number;
  /** The dip plan buys only while the price is at least this far below today's (1 to 50). */
  belowPct: number;
}

export interface PlanLeg {
  /** Unique per plan: a stock can have a regular plan and a dip plan. */
  key: string;
  kind: "regular" | "dip";
  symbol: string;
  stockToken: `0x${string}`;
  weightPct: number;
  amountPerBuy: bigint;
  buys: number;
  /** amountPerBuy x buys: what the contract pulls in and holds for this stock. */
  total: bigint;
}

export interface ComposedPlan {
  legs: PlanLeg[];
  /** Everything the plans will escrow (one USDC approval for exactly this). */
  totalCommitted: bigint;
  /** Budget left over after rounding down to whole buys; it never leaves the wallet. */
  unspent: bigint;
  /** Seconds from the first run to the last. */
  durationSec: number;
  warnings: string[];
}

export type ComposeResult = { ok: true; plan: ComposedPlan } | { ok: false; error: string };

const toBps = (pct: number) => Math.round(pct * 100);

/** Exact-percent check: weights are compared as whole basis points so 33.33 x 3 style rounding cannot hide an error. */
export function validateWeights(weightsPct: number[]): string | null {
  if (weightsPct.length === 0) return "Pick at least one stock.";
  if (weightsPct.length > MAX_BASKET_STOCKS) return `Use at most ${MAX_BASKET_STOCKS} stocks.`;
  for (const w of weightsPct) {
    if (!Number.isFinite(w) || w < 1) return "Each stock needs at least 1%.";
  }
  const sum = weightsPct.reduce((s, w) => s + toBps(w), 0);
  if (sum !== 10_000) return `The shares add up to ${(sum / 100).toFixed(2)}%, they need to add up to 100%.`;
  return null;
}

/** Equal weights in basis-point-exact percent (the first stocks take the leftover cents). */
export function equalWeights(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(10_000 / n);
  const extra = 10_000 - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}

/**
 * Scale any positive weights to percents that add up to exactly 100.00 (largest-remainder rounding to
 * basis points). Used when a saved mix has to be trimmed to the stocks that plans support.
 */
export function normalizeWeights(raw: number[]): number[] {
  const clean = raw.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  if (clean.length === 0 || total <= 0) return equalWeights(clean.length);
  const exact = clean.map((w) => (w / total) * 10_000);
  const bps = exact.map(Math.floor);
  let left = 10_000 - bps.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) bps[order[k].i] += 1;
  return bps.map((b) => b / 100);
}

export function composeBasketPlan(input: {
  stocks: ComposerStock[];
  /** Total budget in USDC base units (6 decimals). */
  budget: bigint;
  buys: number;
  intervalSec: number;
  /** The wallet's USDC balance, so a plan it cannot pay for is refused up front. */
  balance: bigint;
  dip?: DipOption | null;
}): ComposeResult {
  const { stocks, budget, buys, intervalSec, balance, dip = null } = input;
  const weightError = validateWeights(stocks.map((s) => s.weightPct));
  if (weightError) return { ok: false, error: weightError };
  if (new Set(stocks.map((s) => s.stockToken.toLowerCase())).size !== stocks.length) return { ok: false, error: "A stock is listed twice." };
  if (budget <= 0n) return { ok: false, error: "Enter a total budget." };
  if (!Number.isInteger(buys) || buys < 1 || buys > MAX_DCA_BUYS) return { ok: false, error: `Number of buys must be between 1 and ${MAX_DCA_BUYS}.` };
  if (!Number.isInteger(intervalSec) || intervalSec < MIN_DCA_INTERVAL_SEC) return { ok: false, error: "Buys must be at least 1 hour apart." };

  if (dip) {
    if (!Number.isFinite(dip.sharePct) || dip.sharePct < 10 || dip.sharePct > 90) return { ok: false, error: "Keep between 10% and 90% of the budget for dips." };
    if (!Number.isFinite(dip.belowPct) || dip.belowPct < 1 || dip.belowPct > 50) return { ok: false, error: "A dip means 1% to 50% below today's price." };
  }

  const legs: PlanLeg[] = [];
  const warnings: string[] = [];
  for (const s of stocks) {
    const share = (budget * BigInt(toBps(s.weightPct))) / 10_000n;
    const forDips = dip ? (share * BigInt(toBps(dip.sharePct))) / 10_000n : 0n;
    const parts: Array<["regular" | "dip", bigint]> = dip ? [["regular", share - forDips], ["dip", forDips]] : [["regular", share]];
    for (const [kind, part] of parts) {
      const word = kind === "dip" ? "dip buy" : "buy";
      const amountPerBuy = part / BigInt(buys);
      if (amountPerBuy < MIN_BUY_USDC) {
        return { ok: false, error: `${s.symbol}: each ${word} would be under $1. Use a bigger budget, fewer buys or fewer stocks.` };
      }
      const total = amountPerBuy * BigInt(buys);
      if (total > s.maxQuoteIn) {
        const capUsd = Number(s.maxQuoteIn) / 1e6;
        return { ok: false, error: `${s.symbol}: its plan would be $${(Number(total) / 1e6).toFixed(2)}, above the $${capUsd.toLocaleString()} per-plan limit during beta.` };
      }
      const small = `${s.symbol}: buys under $5 lose a larger share to fees.`;
      if (amountPerBuy < SOFT_MIN_BUY_USDC && !warnings.includes(small)) warnings.push(small);
      legs.push({ key: `${s.symbol}:${kind}`, kind, symbol: s.symbol, stockToken: s.stockToken, weightPct: s.weightPct, amountPerBuy, buys, total });
    }
  }

  const totalCommitted = legs.reduce((a, l) => a + l.total, 0n);
  if (totalCommitted > balance) return { ok: false, error: "The plans need more USDC than your wallet holds." };
  return { ok: true, plan: { legs, totalCommitted, unspent: budget - totalCommitted, durationSec: (buys - 1) * intervalSec, warnings } };
}

/** The price a plan should not buy above: `pctAbove` percent over today's price, as the contract's 8-decimal price. */
export function ceilingFromPct(todayPrice8: bigint | null, pctAbove: number): bigint | null {
  if (!todayPrice8 || todayPrice8 <= 0n || !Number.isFinite(pctAbove) || pctAbove < 0 || pctAbove > 1000) return null;
  const bps = BigInt(Math.round(pctAbove * 100));
  return (todayPrice8 * (10_000n + bps)) / 10_000n;
}

/** The ceiling of a dip plan: `pctBelow` percent under today's price, as the contract's 8-decimal price. */
export function ceilingBelow(todayPrice8: bigint | null, pctBelow: number): bigint | null {
  if (!todayPrice8 || todayPrice8 <= 0n || !Number.isFinite(pctBelow) || pctBelow <= 0 || pctBelow >= 100) return null;
  const price = (todayPrice8 * (10_000n - BigInt(Math.round(pctBelow * 100)))) / 10_000n;
  return price > 0n ? price : null;
}

/** One-tap starting points. They only fill in the form; everything stays editable. */
export const PLAN_PRESETS: ReadonlyArray<{ id: string; label: string; note: string; buys: number; intervalSec: number; dip: DipOption | null }> = [
  { id: "weekly", label: "Weekly buys", note: "A little every week for 12 weeks.", buys: 12, intervalSec: 604_800, dip: null },
  { id: "spread", label: "Spread a lump sum", note: "Ease one amount in over 4 weekly buys.", buys: 4, intervalSec: 604_800, dip: null },
  { id: "dips", label: "Extra on dips", note: "Buys weekly, and keeps 30% back to buy only when a price is 5% lower than today.", buys: 12, intervalSec: 604_800, dip: { sharePct: 30, belowPct: 5 } },
];

/** How a keeper fee shows up on a plan: fee percent of what is bought, in total dollars. */
export function keeperFeeUsd(totalCommitted: bigint, keeperFeeBps: number): number {
  return (Number(totalCommitted) / 1e6) * (keeperFeeBps / 10_000);
}

export { PRICE_DECIMALS };
