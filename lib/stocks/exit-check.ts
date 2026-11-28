/**
 * "Can I get out?": how much of a stock could be sold right now before the price moves hard.
 * Asks for real sell quotes at growing sizes and compares each with the price of a tiny sale, so
 * trading fees cancel out and what is left is the price impact. Pure apart from the quote it is given.
 */

export const EXIT_SIZES_USD = [100, 1_000, 5_000, 25_000, 100_000, 250_000, 1_000_000] as const;
export const EXIT_MAX_IMPACT_PCT = 2;
/** The tiny sale every size is measured against, in tokens. */
const PROBE_TOKENS = 0.01;

/** USDC received for selling `tokens`; null when there is no route. Throws if the price can't be read. */
export type SellQuote = (tokens: number) => Promise<number | null>;

export type ExitCheck =
  | { kind: "no-route" }
  | {
      kind: "checked";
      /** Largest size (USD) that stays within the limit, or null when even the smallest doesn't. */
      okUsd: number | null;
      /** The first size that goes past it; null when every size passed. `impactPct` null = can't be sold in one go. */
      over: { usd: number; impactPct: number | null } | null;
    };

export async function checkExit(quote: SellQuote): Promise<ExitCheck> {
  const probe = await quote(PROBE_TOKENS);
  if (probe === null || !(probe > 0)) return { kind: "no-route" };
  const price = probe / PROBE_TOKENS;

  let okUsd: number | null = null;
  // One size at a time, stopping at the first that fails, so a thin market costs few requests.
  for (const usd of EXIT_SIZES_USD) {
    const tokens = usd / price;
    const out = await quote(tokens);
    if (out === null) return { kind: "checked", okUsd, over: { usd, impactPct: null } };
    const impactPct = Math.max(0, (1 - out / tokens / price) * 100);
    if (impactPct > EXIT_MAX_IMPACT_PCT) return { kind: "checked", okUsd, over: { usd, impactPct } };
    okUsd = usd;
  }
  return { kind: "checked", okUsd, over: null };
}

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

export function describeExit(r: ExitCheck, symbol: string): string {
  if (r.kind === "no-route") return `No route to sell ${symbol} right now.`;
  const next = !r.over
    ? ""
    : r.over.impactPct === null
      ? `${usd(r.over.usd)} can't be sold in one go.`
      : `Selling ${usd(r.over.usd)} would move it about ${r.over.impactPct.toFixed(1)}%.`;
  if (r.okUsd === null) return `Even a ${usd(EXIT_SIZES_USD[0])} sale is too big for this market. ${next}`.trim();
  return `A sale of ${usd(r.okUsd)} moves the price ${EXIT_MAX_IMPACT_PCT}% or less. ${next}`.trim();
}
