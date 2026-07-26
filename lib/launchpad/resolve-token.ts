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

/** Pre-2018 tokens (MKR and friends) return a padded bytes32 instead of a string. */
const ERC20_BYTES32_META_ABI = [
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
] as const;

function isAddressLike(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

function decodeBytes32(value: `0x${string}`): string {
  let out = "";
  for (let i = 2; i < value.length; i += 2) {
    const byte = parseInt(value.slice(i, i + 2), 16);
    if (byte === 0) break;
    out += String.fromCharCode(byte);
  }
  return out.trim();
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

/**
 * Build a token straight from its contract when no indexer knows about it yet.
 *
 * DexScreener only lists tokens once it has indexed a pool, which can lag a new
 * launch by minutes and may never happen for thin or unusual pairs. Refusing to
 * resolve those made perfectly tradeable tokens unreachable in the app, so the
 * contract itself is the source of truth here and the quote step decides
 * whether a route actually exists.
 *
 * A successful `symbol()` and `decimals()` is what proves this is an ERC-20;
 * anything that fails both the string and bytes32 shapes is rejected.
 */
async function resolveErc20OnChain(
  addr: `0x${string}`
): Promise<LaunchedToken | null> {
  const pub = createPublicOnlyBaseClient();
  try {
    const code = await pub.getCode({ address: addr });
    if (!code || code === "0x") return null;

    const [symbolRaw, decimalsRaw] = await Promise.all([
      pub
        .readContract({ address: addr, abi: ERC20_META_ABI, functionName: "symbol" })
        .then((s) => String(s))
        .catch(async () =>
          decodeBytes32(
            await pub.readContract({
              address: addr,
              abi: ERC20_BYTES32_META_ABI,
              functionName: "symbol",
            })
          )
        ),
      pub.readContract({
        address: addr,
        abi: ERC20_META_ABI,
        functionName: "decimals",
      }),
    ]);

    const symbol = symbolRaw.trim();
    const decimals = Number(decimalsRaw);
    if (!symbol || !Number.isFinite(decimals) || decimals < 0 || decimals > 36) {
      return null;
    }

    const name = await pub
      .readContract({ address: addr, abi: ERC20_META_ABI, functionName: "name" })
      .then((n) => String(n))
      .catch(async () =>
        decodeBytes32(
          await pub.readContract({
            address: addr,
            abi: ERC20_BYTES32_META_ABI,
            functionName: "name",
          })
        )
      )
      .catch(() => "");

    return {
      address: addr.toLowerCase(),
      name: name.trim() || symbol,
      symbol: symbol.toUpperCase(),
      decimals,
      creator: "",
      txHash: "",
      createdAt: 0,
      source: addr.toLowerCase().startsWith("0xb20") ? "b20" : "external",
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
    const onChain = await resolveErc20OnChain(addr as `0x${string}`);
    return onChain ? { token: onChain, market: null } : { token: null, market: null };
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
