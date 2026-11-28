/**
 * "Your own stock index": weights that respect the owner's rules, and the plain-language reasons an
 * index can't be bought as it stands. Pure (no network, no React). All weights are percent of the
 * whole index, so whatever the stocks don't take stays as cash.
 */
import { drift, type StockHolding, type Targets } from "@/lib/stocks/portfolio-math";

/** One purchase is one transaction; this is the most stocks it carries. */
export const MAX_INDEX_STOCKS = 10;
export const MIN_INDEX_STOCKS = 2;
const MIN_WEIGHT_PCT = 1;
const MIN_BUY_USD = 1;
/** Price noise allowed above the limit before a held stock counts as breaking it. */
const BREACH_ROOM_PTS = 0.5;

export interface IndexRules {
  /** Most any one company may take, percent of the index. */
  maxPct: number;
  /** Least that stays as cash (USDC), percent of the index. */
  cashPct: number;
}

export const DEFAULT_INDEX_RULES: IndexRules = { maxPct: 25, cashPct: 10 };

export interface IndexIssue {
  id: string;
  /** "block" stops the purchase; "note" is only worth knowing. */
  level: "block" | "note";
  text: string;
  symbol?: string;
}

const hundredths = (n: number) => Math.round(n * 100);
const sum = (w: Record<string, number>) => Object.values(w).reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);
const show = (n: number) => `${Number(n.toFixed(2))}%`;

/** The first `max` stocks of a starting list that the owner hasn't left out. */
export function pickStocks(pool: readonly string[], excluded: ReadonlySet<string>, max = MAX_INDEX_STOCKS): string[] {
  return [...new Set(pool)].filter((s) => !excluded.has(s)).slice(0, max);
}

/**
 * Share (100 − cash)% across the stocks in proportion to `base`, never above the limit. Weight a
 * capped stock can't take goes to the others; what nobody can take stays as cash.
 */
export function fitWeights(base: Record<string, number>, rules: IndexRules): Record<string, number> {
  const symbols = Object.keys(base);
  if (symbols.length === 0) return {};
  const cap = Math.max(0, hundredths(rules.maxPct));
  const usable = symbols.map((s) => (Number.isFinite(base[s]) && base[s]! > 0 ? base[s]! : 0));
  // Nothing to go by (all zero): split evenly.
  const ratio = new Map(symbols.map((s, i) => [s, usable.some((n) => n > 0) ? usable[i]! : 1]));
  let left = Math.max(0, hundredths(100 - rules.cashPct));
  const out = new Map<string, number>(symbols.map((s) => [s, 0]));
  let open = symbols.filter((s) => ratio.get(s)! > 0);
  while (open.length > 0) {
    const total = open.reduce((s, sym) => s + ratio.get(sym)!, 0);
    const over = open.filter((sym) => (left * ratio.get(sym)!) / total >= cap);
    if (over.length === 0) {
      const room = left;
      for (const sym of open) {
        const part = Math.floor((room * ratio.get(sym)!) / total);
        out.set(sym, part);
        left -= part;
      }
      // Hand out the rounding leftovers one hundredth at a time.
      for (const sym of open) {
        if (left > 0 && out.get(sym)! < cap) {
          out.set(sym, out.get(sym)! + 1);
          left--;
        }
      }
      break;
    }
    for (const sym of over) out.set(sym, cap);
    left -= cap * over.length;
    open = open.filter((sym) => !over.includes(sym));
  }
  return Object.fromEntries(symbols.map((s) => [s, out.get(s)! / 100]));
}

/** USDC per stock, rounded down to cents so the buys never exceed the total. */
export function indexLegs(weights: Record<string, number>, totalUsd: number): Array<{ symbol: string; amount: string }> {
  if (!Number.isFinite(totalUsd) || totalUsd <= 0) return [];
  const cents = Math.round(totalUsd * 100);
  return Object.entries(weights)
    .map(([symbol, pct]) => ({ symbol, cents: Math.floor((cents * hundredths(pct)) / 10000) }))
    .filter((l) => l.cents > 0)
    .map((l) => ({ symbol: l.symbol, amount: (l.cents / 100).toFixed(2) }));
}

/** USDC that stays in the wallet after those buys. */
export function cashKept(legs: Array<{ amount: string }>, totalUsd: number): number {
  return Math.max(0, Math.round(totalUsd * 100) - legs.reduce((s, l) => s + Math.round(Number(l.amount) * 100), 0)) / 100;
}

export function checkIndex(p: {
  weights: Record<string, number>;
  rules: IndexRules;
  totalUsd: number;
  /** Stocks with no route to buy right now. */
  unavailable?: readonly string[];
}): IndexIssue[] {
  const { weights, rules, totalUsd } = p;
  const entries = Object.entries(weights);
  const out: IndexIssue[] = [];
  const block = (id: string, text: string, symbol?: string) => out.push({ id, level: "block", text, symbol });

  if (entries.length < MIN_INDEX_STOCKS) block("too-few", `Pick at least ${MIN_INDEX_STOCKS} stocks.`);
  if (entries.length > MAX_INDEX_STOCKS) block("too-many", `Use at most ${MAX_INDEX_STOCKS} stocks.`);
  for (const [symbol, pct] of entries) {
    if (p.unavailable?.includes(symbol)) {
      block(`unavailable-${symbol}`, `${symbol} can't be bought right now: no route on Base. Take it out, or try again later.`, symbol);
    }
    if (!Number.isFinite(pct) || pct < MIN_WEIGHT_PCT) block(`small-${symbol}`, `${symbol} needs at least ${MIN_WEIGHT_PCT}%.`, symbol);
    else if (pct > rules.maxPct + 0.001) block(`limit-${symbol}`, `${symbol} is ${show(pct)}, above your ${show(rules.maxPct)} limit.`, symbol);
  }

  const invested = sum(weights);
  const allowed = 100 - rules.cashPct;
  if (invested > allowed + 0.001) {
    block("cash", `Your stocks add up to ${show(invested)}. Keeping ${show(rules.cashPct)} as cash, they can take ${show(allowed)} at most.`);
  } else if (entries.length >= MIN_INDEX_STOCKS && allowed - invested > 0.5) {
    out.push({ id: "extra-cash", level: "note", text: `${show(100 - invested)} stays as cash, more than the ${show(rules.cashPct)} you asked for. Add a stock or raise the limit to invest it.` });
  }

  const weighted = entries.filter(([, pct]) => Number.isFinite(pct) && pct >= MIN_WEIGHT_PCT);
  if (!Number.isFinite(totalUsd) || totalUsd <= 0) block("amount", "Enter how much USDC the index is worth.");
  else if (weighted.length > 0) {
    const smallest = Math.min(...weighted.map(([, pct]) => pct));
    const needed = Math.ceil((MIN_BUY_USD * 100) / smallest);
    if (totalUsd < needed) block("amount", `Use at least $${needed} so every stock gets $${MIN_BUY_USD} or more.`);
  }
  return out;
}

/** The stocks-only mix (adds up to 100) that the Holdings rebalance works with. */
export function targetsFromIndex(weights: Record<string, number>): Targets {
  const entries = Object.entries(weights).filter(([, pct]) => pct > 0);
  const total = entries.reduce((s, [, pct]) => s + pct, 0);
  if (total <= 0) return {};
  const parts = entries.map(([symbol, pct]) => ({ symbol, n: Math.floor((pct / total) * 10000) }));
  let left = 10000 - parts.reduce((s, x) => s + x.n, 0);
  for (const x of parts) {
    if (left > 0) {
      x.n++;
      left--;
    }
  }
  return Object.fromEntries(parts.map((x) => [x.symbol, x.n / 100]));
}

/**
 * Held stocks that have grown past the limit. `cashPct` is the part of the index meant to sit in
 * cash, so a stock's share of the index is its share of the stocks scaled by the rest.
 */
export function limitBreaches(holdings: StockHolding[], targets: Targets, rules: IndexRules): Array<{ symbol: string; nowPct: number }> {
  return drift(holdings, targets)
    .rows.map((r) => ({ symbol: r.symbol, nowPct: (r.currentPct * (100 - rules.cashPct)) / 100 }))
    .filter((r) => r.nowPct > rules.maxPct + BREACH_ROOM_PTS);
}

export const targetsKey = (wallet: string) => `stock_portfolio_targets_v1_${wallet.toLowerCase()}`;
export const rulesKey = (wallet: string) => `stock_index_rules_v1_${wallet.toLowerCase()}`;

/** Saved rules, or null when missing or not usable. */
export function parseRules(raw: string | null): IndexRules | null {
  try {
    const r = JSON.parse(raw ?? "null") as Partial<IndexRules> | null;
    const ok = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
    return r && ok(r.maxPct, MIN_WEIGHT_PCT, 100) && ok(r.cashPct, 0, 99) ? { maxPct: r.maxPct, cashPct: r.cashPct } : null;
  } catch {
    return null;
  }
}
