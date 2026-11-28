/**
 * A shared index lives entirely in its link: the stocks, their weights and the two rules. No amounts
 * and no wallet. Everything read back is checked against Base's official stock list, so a link can
 * never put free text on a page or a preview card.
 */
import { BASE_OFFICIAL_STOCKS } from "@/lib/stocks/base-verified";
import { MAX_INDEX_STOCKS, MIN_INDEX_STOCKS, parseRules, type IndexRules } from "@/lib/stocks/index-builder";

export interface SharedIndex {
  weights: Record<string, number>;
  rules: IndexRules;
}

const SYMBOLS = new Set(BASE_OFFICIAL_STOCKS.map((s) => s.symbol));
const NUMBER = /^\d{1,3}(\.\d{1,2})?$/;

/** `mix=NVDAc-25,GOOGLc-15&max=25&cash=10` */
export function encodeIndex({ weights, rules }: SharedIndex): string {
  const two = (n: number) => String(Math.round(n * 100) / 100);
  const mix = Object.entries(weights)
    .map(([symbol, pct]) => `${symbol}-${two(pct)}`)
    .join(",");
  return new URLSearchParams({ mix, max: two(rules.maxPct), cash: two(rules.cashPct) }).toString();
}

/** The shared index in these query parameters, or null when any part of it isn't usable. */
export function decodeIndex(params: { get(name: string): string | null }): SharedIndex | null {
  const parts = (params.get("mix") ?? "").split(",");
  const max = params.get("max") ?? "";
  const cash = params.get("cash") ?? "";
  if (parts.length < MIN_INDEX_STOCKS || parts.length > MAX_INDEX_STOCKS || !NUMBER.test(max) || !NUMBER.test(cash)) return null;
  const rules = parseRules(JSON.stringify({ maxPct: Number(max), cashPct: Number(cash) }));
  if (!rules) return null;

  const weights: Record<string, number> = {};
  let total = 0;
  for (const part of parts) {
    const [symbol = "", pct = "", ...rest] = part.split("-");
    const n = Number(pct);
    if (rest.length || !SYMBOLS.has(symbol) || symbol in weights || !NUMBER.test(pct) || n < 1 || n > 100) return null;
    weights[symbol] = n;
    total += n;
  }
  return total <= 100.001 ? { weights, rules } : null;
}
