/** Basket definitions and the per-stock amounts. Pure, so it can be tested without React. */

export interface Basket {
  id: string;
  title: string;
  note: string;
  /** Tokenized-stock symbols; only the ones that are live on Base are offered. */
  symbols: string[];
}

export const BASKETS: Basket[] = [
  { id: "big-tech", title: "Big Tech", note: "The seven biggest US tech companies.", symbols: ["NVDAc", "AAPLc", "MSFTc", "GOOGLc", "AMZNc", "METAc", "TSLAc"] },
  { id: "ai-chips", title: "AI & chips", note: "The companies making AI hardware and software.", symbols: ["NVDAc", "AMDc", "AVGOc", "ARMc", "MRVLc", "ORCLc"] },
  { id: "crypto-linked", title: "Crypto-linked", note: "Public companies tied to crypto markets.", symbols: ["MSTRc", "HOODc", "CRCLc", "PYPLc"] },
  { id: "health", title: "Healthcare", note: "Large drug makers and insurers.", symbols: ["LLYc", "JNJc", "MRKc", "PFEc", "UNHc"] },
];

/** Smallest amount per stock we suggest (below this a swap's fees and slippage dominate). */
export const MIN_PER_LEG = 1;

/**
 * Equal USDC per stock, rounded down to cents, with the leftover cents added to the first stocks
 * so the legs add up to the total exactly.
 */
export function basketLegs(symbols: string[], total: number): { items: Array<{ symbol: string; amount: string }>; error?: string } {
  const n = symbols.length;
  if (n < 2) return { items: [], error: "This basket isn't available right now." };
  if (!Number.isFinite(total) || total <= 0) return { items: [], error: "Enter how much USDC to spend." };
  const cents = Math.round(total * 100);
  if (cents / n < MIN_PER_LEG * 100) return { items: [], error: `Use at least $${n * MIN_PER_LEG} so each stock gets $${MIN_PER_LEG} or more.` };
  const base = Math.floor(cents / n);
  const extra = cents - base * n;
  return { items: symbols.map((symbol, i) => ({ symbol, amount: ((base + (i < extra ? 1 : 0)) / 100).toFixed(2) })) };
}
