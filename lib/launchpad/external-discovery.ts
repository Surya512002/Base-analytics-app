import {
  fetchDexScreenerBatch,
  fetchMarketSummaries,
  pickBestPair,
  type DexScreenerPair,
  type TokenMarketSummary,
} from "@/lib/launchpad/dexscreener";
import { isB20TokenAddress } from "@/lib/launchpad/token-meta";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { discoverGeckoTrendingBase } from "@/lib/launchpad/gecko-discovery";

const MIN_LIQUIDITY_USD = 3_000;
const MAX_TRENDING = 40;

/** Well-known Base tokens — reliable seed when DexScreener boosts are Solana-heavy. */
const BASE_SEED_ADDRESSES = [
  "0x532f27101965dd16442e59d40670faf5ebb142e4", // BRETT
  "0x4ed4e862860bed51a9570b96d89af5e1b0efefed", // DEGEN
  "0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4", // TOSHI
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", // VIRTUAL
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
  "0x1111111111166b7fe7bd91427724b487980afc69", // ZORA
  "0x0578d8a44db98b23bf096a382e374e8d334df0ce", // HIGHER
  "0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825", // AIXBT
  "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", // cbBTC
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
];

const SEARCH_QUERIES = [
  "brett",
  "degen",
  "toshi",
  "virtual",
  "aerodrome",
  "aixbt",
  "higher",
  "zora",
  "based",
  "keycat",
];

type DexBoost = {
  chainId?: string;
  tokenAddress?: string;
};

type DexSearchResp = {
  pairs?: DexScreenerPair[];
};

async function fetchBoostedAddresses(): Promise<string[]> {
  const urls = [
    "https://api.dexscreener.com/token-boosts/top/v1",
    "https://api.dexscreener.com/token-boosts/latest/v1",
    "https://api.dexscreener.com/token-profiles/latest/v1",
  ];
  const addresses = new Set<string>();

  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const data = (await r.json()) as DexBoost[];
      if (!Array.isArray(data)) continue;
      for (const item of data) {
        if ((item.chainId ?? "").toLowerCase() !== "base") continue;
        const addr = item.tokenAddress?.trim().toLowerCase();
        if (addr?.startsWith("0x") && addr.length === 42) addresses.add(addr);
      }
    } catch {
      /* try next feed */
    }
  }

  return [...addresses];
}

async function fetchSearchAddresses(): Promise<string[]> {
  const addresses = new Set<string>();

  await Promise.all(
    SEARCH_QUERIES.map(async (q) => {
      try {
        const r = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
          { cache: "no-store" }
        );
        if (!r.ok) return;
        const data = (await r.json()) as DexSearchResp;
        for (const pair of data.pairs ?? []) {
          if ((pair.chainId ?? "").toLowerCase() !== "base") continue;
          if ((pair.liquidity?.usd ?? 0) < MIN_LIQUIDITY_USD) continue;
          const addr = pair.baseToken?.address?.trim().toLowerCase();
          if (addr?.startsWith("0x") && addr.length === 42) addresses.add(addr);
        }
      } catch {
        /* skip query */
      }
    })
  );

  return [...addresses];
}

function pairToExternalToken(
  address: string,
  pair: DexScreenerPair | null,
  market: TokenMarketSummary
): LaunchedToken | null {
  if (!market.hasPool || (market.liquidityUsd ?? 0) < MIN_LIQUIDITY_USD) return null;

  const name = pair?.baseToken?.name?.trim() || "Base Token";
  const symbol = pair?.baseToken?.symbol?.trim().toUpperCase() || "TOKEN";
  const meta = pair?.info;

  return {
    address: address.toLowerCase(),
    name,
    symbol,
    decimals: 18,
    creator: "",
    txHash: "",
    createdAt: 0,
    source: "external",
    imageUrl: meta?.imageUrl,
    description: meta?.description,
    website: meta?.websites?.[0]?.url,
    twitter: meta?.socials?.find((s) => s.type === "twitter")?.url,
    telegram: meta?.socials?.find((s) => s.type === "telegram")?.url,
  };
}

/** DexScreener + GeckoTerminal Base tokens with liquidity — non-B20 tradeable set. */
export async function discoverTrendingBaseTokens(): Promise<{
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
}> {
  const [gecko, dex] = await Promise.all([
    discoverGeckoTrendingBase().catch(() => ({ tokens: [], markets: {} })),
    discoverTrendingFromDexScreener().catch(() => ({ tokens: [], markets: {} })),
  ]);

  const byAddr = new Map<string, LaunchedToken>();
  const markets: Record<string, TokenMarketSummary> = { ...gecko.markets, ...dex.markets };

  for (const token of [...gecko.tokens, ...dex.tokens]) {
    if (isB20TokenAddress(token.address)) continue;
    const key = token.address.toLowerCase();
    const prev = byAddr.get(key);
    byAddr.set(key, {
      ...prev,
      ...token,
      imageUrl: token.imageUrl || prev?.imageUrl,
      description: token.description || prev?.description,
    });
  }

  const tokens = [...byAddr.values()].sort((a, b) => {
    const va = markets[a.address.toLowerCase()]?.volume24h ?? 0;
    const vb = markets[b.address.toLowerCase()]?.volume24h ?? 0;
    return vb - va;
  });

  return { tokens, markets };
}

async function discoverTrendingFromDexScreener(): Promise<{
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
}> {
  const [boosted, searched] = await Promise.all([
    fetchBoostedAddresses(),
    fetchSearchAddresses(),
  ]);

  const candidates = [
    ...new Set([
      ...boosted,
      ...searched,
      ...BASE_SEED_ADDRESSES.map((a) => a.toLowerCase()),
    ]),
  ];

  if (!candidates.length) {
    return { tokens: [], markets: {} };
  }

  const markets = await fetchMarketSummaries(candidates.slice(0, MAX_TRENDING * 2));
  const tokens: LaunchedToken[] = [];

  const ranked = candidates
    .map((addr) => ({ addr, market: markets[addr] }))
    .filter((x) => x.market?.hasPool && (x.market.liquidityUsd ?? 0) >= MIN_LIQUIDITY_USD)
    .sort((a, b) => (b.market?.volume24h ?? 0) - (a.market?.volume24h ?? 0))
    .slice(0, MAX_TRENDING);

  const batch = await fetchDexScreenerBatch(ranked.map((r) => r.addr));

  for (const { addr, market } of ranked) {
    const pairs = batch.get(addr) ?? [];
    const best = pickBestPair(pairs);
    const token = pairToExternalToken(addr, best, market);
    if (token && !isB20TokenAddress(token.address)) tokens.push(token);
  }

  return { tokens, markets };
}
