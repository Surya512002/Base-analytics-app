import { fetchDexScreenerBatch, pickBestPair, summarizePair } from "@/lib/launchpad/dexscreener";
import { formatUsd } from "@/lib/launchpad/format";
import type { OgTokenCardData } from "./types";

/** A pool thinner than this can be pushed to any price, so no numbers are shown for it. */
export const MIN_CARD_LIQUIDITY_USD = 10_000;

/** Token names are chosen by whoever deploys the token: no links, and a hard length limit. */
export function cardLabel(text: string | undefined, max: number): string | undefined {
  const t = text?.replace(/\s+/g, " ").trim();
  if (!t || /:\/\/|www\.|\.[a-z]{2,}\b/i.test(t)) return undefined;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

const compactUsd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${n.toFixed(0)}`);

/**
 * Everything on a token sharing image, looked up here from the token address. Nothing comes from
 * the image's web address, so nobody can make the app picture a price of their own choosing.
 */
export async function tokenCardData(address: string): Promise<OgTokenCardData | null> {
  const token = address.toLowerCase();
  const pairs = (await fetchDexScreenerBatch([token])).get(token) ?? [];
  const best = pickBestPair(pairs.filter((p) => p.baseToken?.address?.toLowerCase() === token));
  const symbol = cardLabel(best?.baseToken?.symbol, 12);
  if (!best || !symbol) return null;

  const card: OgTokenCardData = { address: token, symbol, name: cardLabel(best.baseToken?.name, 32) };
  const m = summarizePair(token, best);
  if ((m.liquidityUsd ?? 0) < MIN_CARD_LIQUIDITY_USD || !m.priceUsd || !Number.isFinite(m.priceUsd)) return card;
  return {
    ...card,
    // formatUsd shortens thousands ("$1.70K"), which is too coarse for a price.
    price:
      m.priceUsd >= 1000
        ? `$${m.priceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
        : formatUsd(m.priceUsd),
    change24h: m.priceChange24h ?? undefined,
    mcap: m.marketCap ? compactUsd(m.marketCap) : undefined,
    asOf: new Date(),
  };
}
