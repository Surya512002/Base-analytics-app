import {
  fetchDexScreenerBatch,
  fetchMarketSummaries,
  mergeMarketSummaries,
  pickBestPair,
  summarizePair,
  type DexScreenerPair,
  type TokenMarketSummary,
} from "@/lib/launchpad/dexscreener";
import { isB20TokenAddress } from "@/lib/launchpad/token-meta";
import type { LaunchedToken } from "@/lib/launchpad/types";
import {
  fetchRecentB20Creates,
  recentB20ToLaunchedToken,
} from "@/lib/launchpad/b20-recent";
import { discoverGeckoTrendingBase } from "@/lib/launchpad/gecko-discovery";

const MIN_LIQUIDITY_USD = 500;
const DEX_SEARCH_QUERIES = ["0xB200", "B20", "RWAGMI", "B420"];

type DexSearchResp = { pairs?: DexScreenerPair[] };

async function fetchDexScreenerB20Addresses(): Promise<string[]> {
  const addresses = new Set<string>();

  await Promise.all(
    DEX_SEARCH_QUERIES.map(async (q) => {
      try {
        const r = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
          { cache: "no-store" }
        );
        if (!r.ok) return;
        const data = (await r.json()) as DexSearchResp;
        for (const pair of data.pairs ?? []) {
          if ((pair.chainId ?? "").toLowerCase() !== "base") continue;
          const addr = pair.baseToken?.address?.trim().toLowerCase();
          if (addr && isB20TokenAddress(addr)) addresses.add(addr);
        }
      } catch {
        /* skip */
      }
    })
  );

  return [...addresses];
}

function pairToB20Token(
  address: string,
  pair: DexScreenerPair | null,
  market: TokenMarketSummary
): LaunchedToken {
  const name = pair?.baseToken?.name?.trim() || "B20 Token";
  const symbol = (pair?.baseToken?.symbol?.trim() || "B20").toUpperCase();
  const meta = pair?.info;

  return {
    address: address.toLowerCase(),
    name,
    symbol,
    decimals: 18,
    creator: "",
    txHash: "",
    createdAt: 0,
    source: "b20",
    imageUrl: meta?.imageUrl,
    description: meta?.description ?? "B20 token on Base",
    website: meta?.websites?.[0]?.url,
    twitter: meta?.socials?.find((s) => s.type === "twitter")?.url,
    telegram: meta?.socials?.find((s) => s.type === "telegram")?.url,
  };
}

/** Aggregate B20 tokens from factory index, Gecko trending, and DexScreener search. */
export async function discoverB20Tokens(): Promise<{
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
}> {
  const [recentCreates, gecko, dexAddrs] = await Promise.all([
    fetchRecentB20Creates().catch(() => []),
    discoverGeckoTrendingBase().catch(() => ({
      tokens: [] as LaunchedToken[],
      markets: {} as Record<string, TokenMarketSummary>,
    })),
    fetchDexScreenerB20Addresses().catch(() => []),
  ]);

  const byAddr = new Map<string, LaunchedToken>();
  const markets: Record<string, TokenMarketSummary> = {};

  for (const row of recentCreates) {
    const token = recentB20ToLaunchedToken(row);
    byAddr.set(token.address.toLowerCase(), token);
  }

  for (const token of gecko.tokens) {
    if (!isB20TokenAddress(token.address)) continue;
    const key = token.address.toLowerCase();
    const prev = byAddr.get(key);
    byAddr.set(key, {
      ...token,
      source: "b20",
      createdAt: prev?.createdAt ?? token.createdAt,
      creator: prev?.creator ?? token.creator,
      txHash: prev?.txHash ?? token.txHash,
      launchBlock: prev?.launchBlock ?? token.launchBlock,
      imageUrl: token.imageUrl || prev?.imageUrl,
    });
    const m = gecko.markets[key];
    if (m) markets[key] = m;
  }

  const unknownDex = dexAddrs.filter((a) => !byAddr.has(a));
  if (unknownDex.length > 0) {
    const dexMarkets = await fetchMarketSummaries(unknownDex).catch(
      () => ({} as Record<string, TokenMarketSummary>)
    );
    const batch = await fetchDexScreenerBatch(unknownDex).catch(() => new Map());

    for (const addr of unknownDex) {
      const market = dexMarkets[addr] ?? summarizePair(addr, null);
      if ((market.liquidityUsd ?? 0) < MIN_LIQUIDITY_USD && !market.hasPool) continue;
      const pairs = batch.get(addr) ?? [];
      const best = pickBestPair(pairs);
      const token = pairToB20Token(addr, best, market);
      byAddr.set(addr, token);
      markets[addr] = market;
    }
  }

  const allAddrs = [...byAddr.keys()];
  if (allAddrs.length > 0) {
    const dexMarkets = await fetchMarketSummaries(allAddrs).catch(
      () => ({} as Record<string, TokenMarketSummary>)
    );
    Object.assign(markets, mergeMarketSummaries(markets, dexMarkets));
  }

  const tokens = [...byAddr.values()].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );

  return { tokens, markets };
}
