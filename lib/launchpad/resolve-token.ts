import {
  fetchDexScreenerBatch,
  pickBestPair,
  summarizePair,
  type TokenMarketSummary,
} from "@/lib/launchpad/dexscreener";
import { getLaunchedToken } from "@/lib/launchpad/token-store";
import type { LaunchedToken } from "@/lib/launchpad/types";

function isAddressLike(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

type PairInfo = {
  imageUrl?: string;
  websites?: Array<{ url?: string }>;
  socials?: Array<{ type?: string; url?: string }>;
  description?: string;
};

function extractMeta(pair: { info?: PairInfo } | null) {
  const info = pair?.info;
  return {
    imageUrl: info?.imageUrl,
    description: info?.description,
    website: info?.websites?.[0]?.url,
    twitter: info?.socials?.find((s) => s.type === "twitter")?.url,
    telegram: info?.socials?.find((s) => s.type === "telegram")?.url,
  };
}

/** Resolve registry token or build tradeable external token from DexScreener. */
export async function resolveTradeableToken(
  address: string
): Promise<{ token: LaunchedToken | null; market: TokenMarketSummary | null }> {
  const addr = address.trim().toLowerCase();
  if (!isAddressLike(addr)) return { token: null, market: null };

  const registered = await getLaunchedToken(addr);
  if (registered) {
    const batch = await fetchDexScreenerBatch([addr]);
    const best = pickBestPair(batch.get(addr) ?? []);
    const market = summarizePair(addr, best);
    return { token: { ...registered, source: "launched" }, market };
  }

  const batch = await fetchDexScreenerBatch([addr]);
  const pairs = batch.get(addr) ?? [];
  const best = pickBestPair(pairs);
  if (!best || (best.liquidity?.usd ?? 0) <= 0) {
    return { token: null, market: null };
  }

  const market = summarizePair(addr, best);
  const meta = extractMeta(best as { info?: PairInfo });

  const isB20 = addr.startsWith("0xb20");
  const token: LaunchedToken = {
    address: addr,
    name: best.baseToken?.name?.trim() || "Base Token",
    symbol: (best.baseToken?.symbol?.trim() || "TOKEN").toUpperCase(),
    decimals: 18,
    creator: "",
    txHash: "",
    createdAt: 0,
    source: isB20 ? "b20" : "external",
    ...meta,
  };

  return { token, market };
}
