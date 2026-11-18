/**
 * Real USD prices for tokenized stocks, from their Base DEX pools (DexScreener).
 *
 * Works on the server (reads DexScreener directly) and in the browser (one POST to our cached
 * /api/launchpad/market/batch endpoint). Results are cached for 60 seconds and shared by every
 * caller, so screens that need prices don't each make their own request.
 *
 * A stock without a pool has no price: callers get `undefined` and show "—", never a guess.
 */
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";

const TTL_MS = 60_000;
const cache = new Map<string, { price: number | null; change24h: number | null; at: number }>();
let inflight: Promise<void> | null = null;
let inflightAddrs = new Set<string>();

async function loadSummaries(addresses: string[]): Promise<Record<string, TokenMarketSummary>> {
  if (typeof window === "undefined") {
    const { fetchMarketSummaries } = await import("@/lib/launchpad/dexscreener");
    return fetchMarketSummaries(addresses);
  }
  const r = await fetch("/api/launchpad/market/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addresses }),
  });
  if (!r.ok) return {};
  const data = (await r.json()) as { markets?: Record<string, TokenMarketSummary> };
  return data.markets ?? {};
}

export type StockQuote = { price: number; change24h: number | null };

/** USD price per token for each address (lower-case keys); missing when there is no pool. */
export async function getStockPricesUsd(addresses: readonly string[]): Promise<Map<string, number>> {
  const quotes = await getStockQuotes(addresses);
  return new Map([...quotes].map(([a, q]) => [a, q.price]));
}

/** Price and 24h change for each address (lower-case keys); missing when there is no pool. */
export async function getStockQuotes(addresses: readonly string[]): Promise<Map<string, StockQuote>> {
  const want = [...new Set(addresses.map((a) => a.toLowerCase()).filter((a) => /^0x[0-9a-f]{40}$/.test(a)))];
  const now = Date.now();
  const stale = want.filter((a) => {
    const c = cache.get(a);
    return !c || now - c.at > TTL_MS;
  });

  if (stale.length) {
    // Join a request already covering these addresses, else start one.
    if (inflight && stale.every((a) => inflightAddrs.has(a))) {
      await inflight.catch(() => {});
    } else {
      inflightAddrs = new Set(stale);
      inflight = loadSummaries(stale.slice(0, 80))
        .then((markets) => {
          const at = Date.now();
          for (const a of stale) {
            const p = markets[a]?.priceUsd;
            const ch = markets[a]?.priceChange24h;
            cache.set(a, {
              price: typeof p === "number" && p > 0 ? p : null,
              change24h: typeof ch === "number" && Number.isFinite(ch) ? ch : null,
              at,
            });
          }
        })
        .catch(() => {
          /* leave uncached: callers show "—" and retry on the next call */
        })
        .finally(() => {
          inflight = null;
        });
      await inflight;
    }
  }

  const out = new Map<string, StockQuote>();
  for (const a of want) {
    const c = cache.get(a);
    if (c?.price != null) out.set(a, { price: c.price, change24h: c.change24h });
  }
  return out;
}
