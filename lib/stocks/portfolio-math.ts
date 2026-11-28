/**
 * Stock portfolio maths: allocation, drift from a target mix, and the trades that bring it back.
 * Pure (no network, no React) so every rule can be tested. Money is plain USD numbers here; the
 * swap itself still goes through the normal quote, price-impact, region and wallet checks.
 */

export interface StockHolding {
  symbol: string;
  valueUsd: number;
}

/** Target mix: stock symbol to percent (all positive, adds up to 100). */
export type Targets = Record<string, number>;

export const MAX_TARGET_STOCKS = 20;
export const MIN_TARGET_STOCKS = 2;
/** Smallest share we accept for one stock; below this a swap's fee and slippage dominate. */
export const MIN_TARGET_PCT = 1;

/** Validate a target mix; returns an error sentence or null when it is usable. */
export function validateTargets(targets: Targets): string | null {
  const entries = Object.entries(targets);
  if (entries.length < MIN_TARGET_STOCKS) return `Pick at least ${MIN_TARGET_STOCKS} stocks.`;
  if (entries.length > MAX_TARGET_STOCKS) return `Use at most ${MAX_TARGET_STOCKS} stocks.`;
  for (const [, pct] of entries) {
    if (!Number.isFinite(pct) || pct < MIN_TARGET_PCT) return `Each stock needs at least ${MIN_TARGET_PCT}%.`;
  }
  const sum = entries.reduce((s, [, p]) => s + p, 0);
  if (Math.abs(sum - 100) > 0.01) return `The shares add up to ${sum.toFixed(2)}%, they need to add up to 100%.`;
  return null;
}

/** Equal split, rounded to 2 decimals, with the leftover added to the first stocks so it sums to 100. */
export function equalTargets(symbols: string[]): Targets {
  const unique = [...new Set(symbols)];
  const n = unique.length;
  if (n === 0) return {};
  const hundredths = 10000;
  const base = Math.floor(hundredths / n);
  const extra = hundredths - base * n;
  const out: Targets = {};
  unique.forEach((s, i) => {
    out[s] = (base + (i < extra ? 1 : 0)) / 100;
  });
  return out;
}

export interface AllocationRow {
  symbol: string;
  valueUsd: number;
  /** Share of the stock holdings, percent. */
  weightPct: number;
}

/** Share of each stock in the stock part of the wallet (stocks only, zero and negative values dropped). */
export function allocation(holdings: StockHolding[]): AllocationRow[] {
  const merged = new Map<string, number>();
  for (const h of holdings) {
    if (!Number.isFinite(h.valueUsd) || h.valueUsd <= 0) continue;
    merged.set(h.symbol, (merged.get(h.symbol) ?? 0) + h.valueUsd);
  }
  const total = [...merged.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  return [...merged.entries()]
    .map(([symbol, valueUsd]) => ({ symbol, valueUsd, weightPct: (valueUsd / total) * 100 }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

export interface DriftRow {
  symbol: string;
  targetPct: number;
  currentPct: number;
  /** current minus target, in percentage points (positive = overweight). */
  driftPts: number;
  currentUsd: number;
  targetUsd: number;
}

/** How far each target stock is from its share, measured against the value of the target stocks plus extra cash. */
export function drift(holdings: StockHolding[], targets: Targets, extraCashUsd = 0): { rows: DriftRow[]; totalUsd: number } {
  const have = new Map(allocation(holdings).map((r) => [r.symbol, r.valueUsd]));
  const cash = Number.isFinite(extraCashUsd) && extraCashUsd > 0 ? extraCashUsd : 0;
  const inTarget = Object.keys(targets).reduce((s, sym) => s + (have.get(sym) ?? 0), 0);
  const totalUsd = inTarget + cash;
  const rows = Object.entries(targets).map(([symbol, targetPct]) => {
    const currentUsd = have.get(symbol) ?? 0;
    const currentPct = totalUsd > 0 ? (currentUsd / totalUsd) * 100 : 0;
    return { symbol, targetPct, currentPct, driftPts: currentPct - targetPct, currentUsd, targetUsd: (totalUsd * targetPct) / 100 };
  });
  return { rows, totalUsd };
}

export interface TradeLeg {
  symbol: string;
  usd: number;
}

export interface RebalancePlan {
  sells: TradeLeg[];
  buys: TradeLeg[];
  totalUsd: number;
  /** Largest drift in percentage points before the plan (for "you are X points off"). */
  maxDriftPts: number;
  /** True when there is nothing worth trading. */
  balanced: boolean;
  /** Set when buys had to be shrunk because sells plus cash could not pay for them. */
  note?: string;
}

export interface RebalanceOptions {
  /** Ignore stocks whose drift is within this many points (default 3). */
  bandPts?: number;
  /** Skip any single trade smaller than this (default $2). */
  minTradeUsd?: number;
  /** USDC the user is adding on top of selling overweight stocks. */
  extraCashUsd?: number;
  /** Stocks to trade even inside the band (for example, ones over an index's limit). */
  force?: readonly string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Sell what is above its share, buy what is below it. Buys are paid by the sells plus any extra
 * cash; if that is not enough they shrink in proportion (we never plan to spend money we do not have).
 */
export function planRebalance(holdings: StockHolding[], targets: Targets, opts: RebalanceOptions = {}): RebalancePlan {
  const band = opts.bandPts ?? 3;
  const minTrade = opts.minTradeUsd ?? 2;
  const cash = Number.isFinite(opts.extraCashUsd) && (opts.extraCashUsd as number) > 0 ? (opts.extraCashUsd as number) : 0;
  const { rows, totalUsd } = drift(holdings, targets, cash);
  const maxDriftPts = rows.reduce((m, r) => Math.max(m, Math.abs(r.driftPts)), 0);
  const empty: RebalancePlan = { sells: [], buys: [], totalUsd, maxDriftPts, balanced: true };
  if (totalUsd <= 0) return empty;

  const sells: TradeLeg[] = [];
  const buys: TradeLeg[] = [];
  for (const r of rows) {
    const delta = r.targetUsd - r.currentUsd; // positive = buy
    if (Math.abs(r.driftPts) < band && !opts.force?.includes(r.symbol) && !(cash > 0 && delta > 0)) continue;
    if (Math.abs(delta) < minTrade) continue;
    if (delta < 0) sells.push({ symbol: r.symbol, usd: round2(Math.min(-delta, r.currentUsd)) });
    else buys.push({ symbol: r.symbol, usd: round2(delta) });
  }
  const proceeds = sells.reduce((s, l) => s + l.usd, 0) + cash;
  const wanted = buys.reduce((s, l) => s + l.usd, 0);
  let note: string | undefined;
  let finalBuys = buys;
  if (wanted > proceeds + 0.005) {
    const k = proceeds / wanted;
    finalBuys = buys.map((l) => ({ symbol: l.symbol, usd: round2(l.usd * k) })).filter((l) => l.usd >= minTrade);
    note = "Buys were reduced to what the sells and your extra cash can pay for.";
  }
  if (sells.length === 0 && finalBuys.length === 0) return { ...empty, maxDriftPts };
  return { sells, buys: finalBuys, totalUsd, maxDriftPts, balanced: false, note };
}

/** Buy-and-hold return of a mix: each stock's period return weighted by its target share. Skips stocks without data. */
export function mixReturnPct(targets: Targets, returnsPct: Record<string, number | null | undefined>): { returnPct: number | null; covered: number } {
  let weight = 0;
  let acc = 0;
  for (const [sym, pct] of Object.entries(targets)) {
    const r = returnsPct[sym];
    if (r == null || !Number.isFinite(r)) continue;
    weight += pct;
    acc += pct * r;
  }
  return weight > 0 ? { returnPct: acc / weight, covered: weight } : { returnPct: null, covered: 0 };
}
