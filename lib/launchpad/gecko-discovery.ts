import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";

type GeckoPool = {
  id?: string;
  attributes?: {
    base_token_price_usd?: string;
    fdv_usd?: string;
    market_cap_usd?: string | null;
    reserve_in_usd?: string;
    volume_usd?: { h24?: string };
    price_change_percentage?: { h24?: string };
    transactions?: { h24?: { buys?: number; sells?: number } };
    address?: string;
  };
  relationships?: {
    base_token?: { data?: { id?: string } };
  };
};

type GeckoToken = {
  id?: string;
  attributes?: {
    address?: string;
    name?: string;
    symbol?: string;
    image_url?: string;
  };
};

type GeckoResp = {
  data?: GeckoPool[];
  included?: GeckoToken[];
};

const GECKO_HEADERS = { Accept: "application/json" };
const MAX_PAGES = 2;

function poolToMarket(address: string, pool: GeckoPool): TokenMarketSummary {
  const attrs = pool.attributes ?? {};
  const buys = attrs.transactions?.h24?.buys ?? 0;
  const sells = attrs.transactions?.h24?.sells ?? 0;
  const volume = attrs.volume_usd?.h24 ? parseFloat(attrs.volume_usd.h24) : null;
  const liquidity = attrs.reserve_in_usd ? parseFloat(attrs.reserve_in_usd) : null;
  const mcap = attrs.market_cap_usd ? parseFloat(attrs.market_cap_usd) : null;
  const fdv = attrs.fdv_usd ? parseFloat(attrs.fdv_usd) : null;
  const change = attrs.price_change_percentage?.h24
    ? parseFloat(attrs.price_change_percentage.h24)
    : null;

  return {
    address: address.toLowerCase(),
    priceUsd: attrs.base_token_price_usd ? parseFloat(attrs.base_token_price_usd) : null,
    priceNative: null,
    marketCap: mcap ?? fdv,
    fdv,
    volume24h: volume,
    liquidityUsd: liquidity,
    priceChange24h: change,
    txns24h: buys + sells,
    dexId: "geckoterminal",
    pairAddress: attrs.address ?? null,
    hasPool: (liquidity ?? 0) > 0,
  };
}

async function fetchGeckoPools(
  path: string,
  maxPages = MAX_PAGES
): Promise<GeckoResp[]> {
  const pages: GeckoResp[] = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const r = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/base/${path}?include=base_token&page=${page}`,
        { cache: "no-store", headers: GECKO_HEADERS }
      );
      if (!r.ok) break;
      pages.push((await r.json()) as GeckoResp);
    } catch {
      break;
    }
  }
  return pages;
}

function ingestGeckoPages(
  pages: GeckoResp[],
  tokens: LaunchedToken[],
  markets: Record<string, TokenMarketSummary>,
  seen: Set<string>
) {
  for (const data of pages) {
    const included = new Map((data.included ?? []).map((t) => [t.id ?? "", t]));
    for (const pool of data.data ?? []) {
      const tokenId = pool.relationships?.base_token?.data?.id ?? "";
      const meta = included.get(tokenId);
      const address = meta?.attributes?.address?.trim().toLowerCase();
      if (!address?.startsWith("0x") || address.length !== 42) continue;

      const market = poolToMarket(address, pool);
      const prev = markets[address];
      markets[address] = prev
        ? {
            ...prev,
            ...market,
            volume24h:
              Math.max(market.volume24h ?? 0, prev.volume24h ?? 0) ||
              market.volume24h ||
              prev.volume24h,
            priceChange24h: market.priceChange24h ?? prev.priceChange24h,
          }
        : market;

      if (seen.has(address)) continue;
      seen.add(address);
      tokens.push({
        address,
        name: meta?.attributes?.name?.trim() || "Base Token",
        symbol: (meta?.attributes?.symbol?.trim() || "TOKEN").toUpperCase(),
        decimals: 18,
        creator: "",
        txHash: "",
        createdAt: 0,
        source: "external",
        imageUrl: meta?.attributes?.image_url,
      });
    }
  }
}

/** GeckoTerminal trending pools on Base — fills gaps DexScreener boosts miss. */
export async function discoverGeckoTrendingBase(): Promise<{
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
}> {
  const tokens: LaunchedToken[] = [];
  const markets: Record<string, TokenMarketSummary> = {};
  const seen = new Set<string>();

  const [trending, volume] = await Promise.all([
    fetchGeckoPools("trending_pools"),
    fetchGeckoPools("pools?sort=h24_volume_usd_desc", 3),
  ]);
  ingestGeckoPages(trending, tokens, markets, seen);
  ingestGeckoPages(volume, tokens, markets, seen);

  return { tokens, markets };
}
