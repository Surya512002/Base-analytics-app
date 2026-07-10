export type DexScreenerPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  priceNative?: string;
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number };
  txns?: {
    h24?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
    m5?: { buys?: number; sells?: number };
  };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  info?: {
    imageUrl?: string;
    websites?: Array<{ url?: string }>;
    socials?: Array<{ type?: string; url?: string }>;
    description?: string;
  };
};

export type TokenMarketSummary = {
  address: string;
  priceUsd: number | null;
  priceNative: number | null;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  liquidityUsd: number | null;
  priceChange24h: number | null;
  txns24h: number | null;
  dexId: string | null;
  pairAddress: string | null;
  hasPool: boolean;
};

export function pickBestPair(pairs: DexScreenerPair[]): DexScreenerPair | null {
  const basePairs = pairs.filter((p) => (p.chainId ?? "").toLowerCase() === "base");
  if (!basePairs.length) return null;
  return (
    [...basePairs].sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
    )[0] ?? null
  );
}

export function summarizePair(address: string, pair: DexScreenerPair | null): TokenMarketSummary {
  if (!pair) {
    return {
      address: address.toLowerCase(),
      priceUsd: null,
      priceNative: null,
      marketCap: null,
      fdv: null,
      volume24h: null,
      liquidityUsd: null,
      priceChange24h: null,
      txns24h: null,
      dexId: null,
      pairAddress: null,
      hasPool: false,
    };
  }

  const buys = pair.txns?.h24?.buys ?? 0;
  const sells = pair.txns?.h24?.sells ?? 0;

  return {
    address: address.toLowerCase(),
    priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
    priceNative: pair.priceNative ? parseFloat(pair.priceNative) : null,
    marketCap: pair.marketCap ?? pair.fdv ?? null,
    fdv: pair.fdv ?? null,
    volume24h: pair.volume?.h24 ?? null,
    liquidityUsd: pair.liquidity?.usd ?? null,
    priceChange24h: pair.priceChange?.h24 ?? null,
    txns24h: buys + sells,
    dexId: pair.dexId ?? null,
    pairAddress: pair.pairAddress ?? null,
    hasPool: (pair.liquidity?.usd ?? 0) > 0,
  };
}

const BATCH_SIZE = 25;

export async function fetchDexScreenerBatch(
  addresses: string[]
): Promise<Map<string, DexScreenerPair[]>> {
  const result = new Map<string, DexScreenerPair[]>();
  if (!addresses.length) return result;

  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const chunk = unique.slice(i, i + BATCH_SIZE);
    try {
      const r = await fetch(
        `https://api.dexscreener.com/tokens/v1/base/${chunk.join(",")}`,
        { cache: "no-store" }
      );
      if (!r.ok) continue;
      const data = (await r.json()) as DexScreenerPair[] | { pairs?: DexScreenerPair[] };

      const pairs = Array.isArray(data) ? data : (data.pairs ?? []);
      for (const pair of pairs) {
        const addr = (pair.baseToken?.address ?? "").toLowerCase();
        if (!addr) continue;
        const existing = result.get(addr) ?? [];
        existing.push(pair);
        result.set(addr, existing);
      }
    } catch (e) {
      console.error("[dexscreener batch]", e);
    }
  }

  return result;
}

export async function fetchMarketSummaries(
  addresses: string[]
): Promise<Record<string, TokenMarketSummary>> {
  const batch = await fetchDexScreenerBatch(addresses);
  const out: Record<string, TokenMarketSummary> = {};

  for (const addr of addresses) {
    const lower = addr.toLowerCase();
    const pairs = batch.get(lower) ?? [];
    const best = pickBestPair(pairs);
    out[lower] = summarizePair(lower, best);
  }

  return out;
}

/** Merge market feeds — DexScreener price change wins over stale Gecko negatives. */
function pickPriceChange24h(
  prev: number | null | undefined,
  next: number | null | undefined
): number | null {
  if (next == null) return prev ?? null;
  if (prev == null) return next;
  if (prev <= 0 && next > 0) return next;
  if (prev === 0 && next !== 0) return next;
  return next;
}

export function mergeMarketSummaries(
  base: Record<string, TokenMarketSummary>,
  overlay: Record<string, TokenMarketSummary>
): Record<string, TokenMarketSummary> {
  const out = { ...base };
  for (const [addr, next] of Object.entries(overlay)) {
    const key = addr.toLowerCase();
    const prev = out[key];
    if (!prev) {
      out[key] = { ...next, address: key };
      continue;
    }
    out[key] = {
      ...prev,
      ...next,
      address: key,
      priceUsd: next.priceUsd ?? prev.priceUsd,
      priceChange24h: pickPriceChange24h(prev.priceChange24h, next.priceChange24h),
      volume24h:
        Math.max(next.volume24h ?? 0, prev.volume24h ?? 0) || next.volume24h || prev.volume24h,
      liquidityUsd:
        Math.max(next.liquidityUsd ?? 0, prev.liquidityUsd ?? 0) ||
        next.liquidityUsd ||
        prev.liquidityUsd,
      marketCap: next.marketCap ?? prev.marketCap,
      hasPool: next.hasPool || prev.hasPool,
    };
  }
  return out;
}
