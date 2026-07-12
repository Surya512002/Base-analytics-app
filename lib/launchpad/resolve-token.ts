import {
  fetchDexScreenerBatch,
  pickBestPair,
  summarizePair,
  type TokenMarketSummary,
} from "@/lib/launchpad/dexscreener";
import { isB20TokenAddress } from "@/lib/launchpad/token-meta";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import { getLaunchedToken } from "@/lib/launchpad/token-store";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { createPublicOnlyBaseClient } from "@/lib/utils/base-rpc";
import { fetchErc20Decimals } from "@/lib/launchpad/erc20-meta";

const B20_FACTORY_ABI = [
  {
    name: "isB20Initialized",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

const ERC20_META_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

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

async function readErc20Decimals(addr: `0x${string}`): Promise<number> {
  return fetchErc20Decimals(addr, 18);
}

/** B20 exists on-chain but DexScreener may lag minutes after LP seed. */
async function resolveB20OnChain(addr: `0x${string}`): Promise<LaunchedToken | null> {
  if (!isB20TokenAddress(addr)) return null;
  const pub = createPublicOnlyBaseClient();
  try {
    const initialized = await pub.readContract({
      address: B20_FACTORY_ADDRESS,
      abi: B20_FACTORY_ABI,
      functionName: "isB20Initialized",
      args: [addr],
    });
    if (!initialized) return null;

    const [name, symbol, decimals] = await Promise.all([
      pub
        .readContract({ address: addr, abi: ERC20_META_ABI, functionName: "name" })
        .catch(() => "B20 Token"),
      pub
        .readContract({ address: addr, abi: ERC20_META_ABI, functionName: "symbol" })
        .catch(() => "B20"),
      pub
        .readContract({ address: addr, abi: ERC20_META_ABI, functionName: "decimals" })
        .catch(() => 18),
    ]);

    return {
      address: addr.toLowerCase(),
      name: String(name).trim() || "B20 Token",
      symbol: String(symbol).trim().toUpperCase() || "B20",
      decimals: Number(decimals) || 18,
      creator: "",
      txHash: "",
      createdAt: Date.now(),
      source: "b20",
      description: "B20 token on Base",
    };
  } catch {
    return null;
  }
}

/** Resolve registry token or build tradeable external token from DexScreener. */
export async function resolveTradeableToken(
  address: string
): Promise<{ token: LaunchedToken | null; market: TokenMarketSummary | null }> {
  const addr = address.trim().toLowerCase();
  if (!isAddressLike(addr)) return { token: null, market: null };

  const registered = await getLaunchedToken(addr);
  const batch = await fetchDexScreenerBatch([addr]);
  const pairs = batch.get(addr) ?? [];
  const best = pickBestPair(pairs);
  const market =
    best && (best.liquidity?.usd ?? 0) > 0 ? summarizePair(addr, best) : null;

  if (registered) {
    return { token: { ...registered, source: "launched" }, market };
  }

  const b20OnChain = await resolveB20OnChain(addr as `0x${string}`);
  if (b20OnChain) {
    const meta = extractMeta(best as { info?: PairInfo } | null);
    return {
      token: { ...b20OnChain, ...meta },
      market,
    };
  }

  if (!best || (best.liquidity?.usd ?? 0) <= 0) {
    return { token: null, market: null };
  }
  const meta = extractMeta(best as { info?: PairInfo });

  const isB20 = addr.startsWith("0xb20");
  const onChainDecimals = await readErc20Decimals(addr as `0x${string}`);
  const token: LaunchedToken = {
    address: addr,
    name: best.baseToken?.name?.trim() || "Base Token",
    symbol: (best.baseToken?.symbol?.trim() || "TOKEN").toUpperCase(),
    decimals: onChainDecimals,
    creator: "",
    txHash: "",
    createdAt: 0,
    source: isB20 ? "b20" : "external",
    ...meta,
  };

  return { token, market: summarizePair(addr, best) };
}
