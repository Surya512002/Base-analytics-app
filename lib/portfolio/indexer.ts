import { parseAbi, getAddress } from "viem";
import { createBasePublicClient } from "../utils/base-rpc";
import { getAlchemyKey, alchemyRpcForKey } from "../constants/env";
import { COMMON_BASE_TOKENS } from "../launchpad/common-tokens";
import { TOKENIZED_STOCKS_REGISTRY } from "../stocks/tokenized-stocks-registry";
import { ALL_VERIFIED_BASE_TOKENS } from "../swap/verified-tokens";

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
]);

export interface DiscoveredTokenBalance {
  address: `0x${string}`;
  balanceBigInt: bigint;
  decimals?: number;
  symbol?: string;
  name?: string;
  logo?: string | null;
  isSpam?: boolean;
}

export interface IndexerFetchResult {
  balances: DiscoveredTokenBalance[];
  nativeEthBigInt: bigint;
  source: "alchemy" | "blockscout" | "onchain_fallback";
  partial: boolean;
  warning?: string;
}

/**
 * Fetch token balances from Alchemy Token Balances API on Base.
 */
async function fetchAlchemyTokenBalances(
  address: `0x${string}`,
  apiKey: string
): Promise<DiscoveredTokenBalance[] | null> {
  const url = alchemyRpcForKey(apiKey);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "alchemy_getTokenBalances",
        params: [address, "erc20"],
        id: 1,
      }),
      signal: AbortSignal.timeout(6_000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: {
        tokenBalances?: Array<{
          contractAddress: string;
          tokenBalance: string;
          error?: string | null;
        }>;
      };
    };

    if (!data.result?.tokenBalances) return null;

    const list: DiscoveredTokenBalance[] = [];
    for (const item of data.result.tokenBalances) {
      if (item.error || !item.tokenBalance || item.tokenBalance === "0x" || item.tokenBalance === "0x0") {
        continue;
      }
      try {
        const bal = BigInt(item.tokenBalance);
        if (bal > BigInt(0)) {
          list.push({
            address: getAddress(item.contractAddress),
            balanceBigInt: bal,
          });
        }
      } catch {
        // Skip unparseable balances
      }
    }
    return list;
  } catch {
    return null;
  }
}

/**
 * Fallback to Blockscout token balances API on Base.
 */
async function fetchBlockscoutTokenBalances(
  address: `0x${string}`
): Promise<DiscoveredTokenBalance[] | null> {
  try {
    const res = await fetch(
      `https://base.blockscout.com/api/v2/addresses/${address}/token-balances`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6_000),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      value: string;
      token: {
        address: string;
        name: string;
        symbol: string;
        decimals: string | number;
        type: string;
        icon_url?: string | null;
      };
    }>;

    if (!Array.isArray(data)) return null;

    const list: DiscoveredTokenBalance[] = [];
    for (const item of data) {
      if (!item.token || item.token.type !== "ERC-20") continue;
      const dec = Number(item.token.decimals);
      if (!item.value || item.value === "0") continue;
      try {
        const bal = BigInt(item.value);
        if (bal > BigInt(0)) {
          list.push({
            address: getAddress(item.token.address),
            balanceBigInt: bal,
            decimals: Number.isFinite(dec) && dec >= 0 ? dec : 18,
            symbol: item.token.symbol || "UNKNOWN",
            name: item.token.name || item.token.symbol || "Unknown",
            logo: item.token.icon_url || null,
          });
        }
      } catch {
        // Ignore parsing errors
      }
    }
    return list;
  } catch {
    return null;
  }
}

/**
 * Discover all token balances for a wallet address on Base mainnet.
 * Merges indexer output with authoritative on-chain multicall across:
 * - Native ETH
 * - COMMON_BASE_TOKENS (USDC, WETH, cbBTC, cbETH, AERO, etc.)
 * - All 32 Tokenized Stocks in TOKENIZED_STOCKS_REGISTRY
 * - ALL 3,100+ Verified Base tokens in ALL_VERIFIED_BASE_TOKENS (includes Fren Pet FP, DEGEN, etc.)
 * - User-specified custom token addresses
 */
export async function discoverWalletBalances(
  address: `0x${string}`,
  customTokenAddresses: `0x${string}`[] = []
): Promise<IndexerFetchResult> {
  const client = createBasePublicClient();

  // 1. Always read Native ETH balance on-chain
  const nativeEthBigInt = await client
    .getBalance({ address })
    .catch(() => BigInt(0));

  // 2. Query indexer (Alchemy primary, Blockscout secondary)
  let indexerBalances: DiscoveredTokenBalance[] | null = null;
  let indexerSource: "alchemy" | "blockscout" | "onchain_fallback" = "onchain_fallback";
  let partial = false;
  let warning: string | undefined;

  const alchemyKey = getAlchemyKey();
  if (alchemyKey) {
    indexerBalances = await fetchAlchemyTokenBalances(address, alchemyKey);
    if (indexerBalances != null) {
      indexerSource = "alchemy";
    }
  }

  if (indexerBalances == null) {
    indexerBalances = await fetchBlockscoutTokenBalances(address);
    if (indexerBalances != null) {
      indexerSource = "blockscout";
    }
  }

  if (indexerBalances == null) {
    partial = true;
    warning = "External indexer unavailable; showing verified on-chain tokens. Some unlisted tokens may be missing.";
    indexerBalances = [];
  }

  // 3. Build comprehensive list of authoritative on-chain registry contracts
  const registryAddrs = new Set<string>();
  const priorityContracts: {
    address: `0x${string}`;
    decimals: number;
    symbol: string;
    name: string;
    logoURI?: string | null;
  }[] = [];

  // Add COMMON_BASE_TOKENS
  for (const t of COMMON_BASE_TOKENS) {
    const lower = t.address.toLowerCase();
    if (!registryAddrs.has(lower)) {
      registryAddrs.add(lower);
      priorityContracts.push({
        address: t.address,
        decimals: t.decimals,
        symbol: t.symbol,
        name: t.name,
      });
    }
  }

  // Add all 32 Tokenized Stocks
  for (const s of TOKENIZED_STOCKS_REGISTRY) {
    const lower = s.address.toLowerCase();
    if (!registryAddrs.has(lower)) {
      registryAddrs.add(lower);
      priorityContracts.push({
        address: s.address,
        decimals: s.decimals,
        symbol: s.symbol,
        name: s.name,
      });
    }
  }

  // Add custom user tokens
  for (const customAddr of customTokenAddresses) {
    const lower = customAddr.toLowerCase();
    if (!registryAddrs.has(lower)) {
      registryAddrs.add(lower);
      priorityContracts.push({
        address: customAddr,
        decimals: 18, // default, will be queried if needed
        symbol: "CUSTOM",
        name: "Custom Token",
      });
    }
  }

  // Add all 3,100+ verified Base ecosystem tokens (ensures tradable tokens like Fren Pet 0xFF0C... are always scanned)
  for (const vt of ALL_VERIFIED_BASE_TOKENS) {
    const lower = vt.address.toLowerCase();
    if (!registryAddrs.has(lower)) {
      registryAddrs.add(lower);
      priorityContracts.push({
        address: vt.address,
        decimals: vt.decimals,
        symbol: vt.symbol,
        name: vt.name,
        logoURI: vt.logoURI,
      });
    }
  }

  // 4. Batch multicall for priority registry tokens in parallel chunks (350 tokens per chunk)
  const onChainBalances = new Map<string, bigint>();
  const CHUNK_SIZE = 350;
  const contractChunks: typeof priorityContracts[] = [];
  for (let i = 0; i < priorityContracts.length; i += CHUNK_SIZE) {
    contractChunks.push(priorityContracts.slice(i, i + CHUNK_SIZE));
  }

  try {
    const chunkResults = await Promise.all(
      contractChunks.map((chunk) =>
        client
          .multicall({
            contracts: chunk.map((c) => ({
              address: c.address,
              abi: ERC20_ABI,
              functionName: "balanceOf" as const,
              args: [address] as const,
            })),
          })
          .catch((err) => {
            console.warn("[indexer] Multicall chunk failed, continuing:", err);
            return [];
          })
      )
    );

    for (let c = 0; c < contractChunks.length; c++) {
      const chunk = contractChunks[c]!;
      const results = chunkResults[c] ?? [];
      for (let i = 0; i < chunk.length; i++) {
        const res = results[i];
        if (
          res &&
          res.status === "success" &&
          typeof res.result === "bigint" &&
          res.result > BigInt(0)
        ) {
          const item = chunk[i]!;
          onChainBalances.set(item.address.toLowerCase(), res.result);
        }
      }
    }
  } catch {
    // If multicall failed, continue with indexer balances
  }

  // 5. Merge indexer results with on-chain reads
  const mergedMap = new Map<string, DiscoveredTokenBalance>();

  // Add discovered indexer tokens
  for (const tok of indexerBalances) {
    mergedMap.set(tok.address.toLowerCase(), tok);
  }

  // Override/add verified on-chain balances
  for (const contract of priorityContracts) {
    const lower = contract.address.toLowerCase();
    const bal = onChainBalances.get(lower);
    if (bal && bal > BigInt(0)) {
      mergedMap.set(lower, {
        address: contract.address,
        balanceBigInt: bal,
        decimals: contract.decimals,
        symbol: contract.symbol,
        name: contract.name,
        logo: contract.logoURI || null,
      });
    } else if (onChainBalances.has(lower) && onChainBalances.get(lower) === BigInt(0)) {
      // If multicall explicitly confirmed 0 balance, remove from merged list
      mergedMap.delete(lower);
    }
  }

  // 6. Enrich metadata for tokens missing symbol/name/decimals
  const needsMeta = Array.from(mergedMap.values()).filter(
    (t) => !t.symbol || !t.decimals || !t.name
  );

  if (needsMeta.length > 0) {
    try {
      const metaCalls = needsMeta.flatMap((t) => [
        { address: t.address, abi: ERC20_ABI, functionName: "symbol" as const },
        { address: t.address, abi: ERC20_ABI, functionName: "name" as const },
        { address: t.address, abi: ERC20_ABI, functionName: "decimals" as const },
      ]);

      const metaResults = await client.multicall({ contracts: metaCalls });
      for (let i = 0; i < needsMeta.length; i++) {
        const item = needsMeta[i]!;
        const symRes = metaResults[i * 3];
        const nameRes = metaResults[i * 3 + 1];
        const decRes = metaResults[i * 3 + 2];

        if (symRes?.status === "success" && typeof symRes.result === "string") {
          item.symbol = symRes.result;
        }
        if (nameRes?.status === "success" && typeof nameRes.result === "string") {
          item.name = nameRes.result;
        }
        if (decRes?.status === "success" && typeof decRes.result === "number") {
          item.decimals = decRes.result;
        }
      }
    } catch {
      // Keep best available values
    }
  }

  return {
    balances: Array.from(mergedMap.values()),
    nativeEthBigInt,
    source: indexerSource,
    partial,
    warning,
  };
}
