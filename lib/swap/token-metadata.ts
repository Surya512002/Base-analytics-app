/**
 * On-chain Token Metadata Loader & Verification for Swap
 *
 * Checks curated registries (COMMON_BASE_TOKENS & TOKENIZED_STOCKS_REGISTRY) first for instant resolution.
 * If not curated, fetches name, symbol, and decimals directly on-chain via Base RPC multicall.
 */

import { type Address, isAddress, getAddress } from "viem";
import { COMMON_BASE_TOKENS, type CommonToken } from "@/lib/launchpad/common-tokens";
import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";
import { commonTokenToCounter, enrichSwapCounter } from "@/lib/launchpad/token-logo";
import { ETH_COUNTER, type SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import { createPublicOnlyBaseClient } from "@/lib/utils/base-rpc";
import {
  isVerifiedBaseToken,
  findVerifiedToken,
  registerVerifiedLiquidityToken,
} from "@/lib/swap/verified-tokens";
import { fetchDexScreenerBatch, pickBestPair } from "@/lib/launchpad/dexscreener";

const ERC20_ABI = [
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

export interface ResolvedTokenResult {
  counter: SwapCounter | null;
  isUnverified: boolean;
  error?: string;
}

/**
 * Resolve token by address or symbol ("eth", "aero", "usdc", etc.)
 */
export async function resolveSwapToken(
  addressOrEth: string | null | undefined
): Promise<ResolvedTokenResult> {
  if (!addressOrEth) {
    return { counter: null, isUnverified: false };
  }

  const raw = addressOrEth.trim().toLowerCase();

  // 1. Native ETH check
  if (raw === "eth" || raw === "0x0000000000000000000000000000000000000000") {
    return { counter: { ...ETH_COUNTER, isVerified: true, isUnverified: false }, isUnverified: false };
  }

  // 2. Check Curated Common Base Tokens by Address OR Symbol
  const commonMatch = COMMON_BASE_TOKENS.find(
    (t) => t.address.toLowerCase() === raw || t.symbol.toLowerCase() === raw
  );
  if (commonMatch) {
    const counter = enrichSwapCounter(commonTokenToCounter(commonMatch));
    return {
      counter: {
        ...counter,
        isUnverified: false,
        isVerified: true,
        name: commonMatch.name,
      },
      isUnverified: false,
    };
  }

  // 3. Check Tokenized Stocks Registry by Address OR Symbol
  const stockMatch = TOKENIZED_STOCKS_REGISTRY.find(
    (s) => s.address.toLowerCase() === raw || s.symbol.toLowerCase() === raw
  );
  if (stockMatch) {
    const commonStock: CommonToken = {
      address: stockMatch.address,
      symbol: stockMatch.symbol,
      name: stockMatch.name,
      decimals: stockMatch.decimals,
      category: "stock",
      stockCategory: stockMatch.category,
      underlyingTicker: stockMatch.underlyingTicker,
    };
    const counter = enrichSwapCounter(commonTokenToCounter(commonStock));
    return {
      counter: {
        ...counter,
        isUnverified: false,
        isVerified: true,
        name: stockMatch.name,
      },
      isUnverified: false,
    };
  }

  // 3b. Check Comprehensive Verified Tokens Registry by Address OR Symbol
  const verifiedMatch = findVerifiedToken(raw);
  if (verifiedMatch) {
    let isBlueCheck = isVerifiedBaseToken(verifiedMatch.address);
    let tokenLiquidity: number | undefined;

    if (!isBlueCheck) {
      try {
        const dexBatch = await fetchDexScreenerBatch([verifiedMatch.address]);
        const pairs = dexBatch.get(verifiedMatch.address.toLowerCase()) ?? [];
        const best = pickBestPair(pairs);
        tokenLiquidity = best?.liquidity?.usd;
        if (tokenLiquidity && tokenLiquidity >= 100_000) {
          isBlueCheck = true;
          registerVerifiedLiquidityToken(verifiedMatch.address, tokenLiquidity);
        }
      } catch {
        // Ignore DexScreener fetch error
      }
    }

    const counter = enrichSwapCounter({
      kind: "token",
      address: verifiedMatch.address,
      symbol: verifiedMatch.symbol,
      decimals: verifiedMatch.decimals,
      name: verifiedMatch.name,
      isVerified: isBlueCheck,
      isUnverified: !isBlueCheck,
      liquidityUsd: tokenLiquidity,
    });
    return {
      counter,
      isUnverified: !isBlueCheck,
    };
  }

  if (!isAddress(raw)) {
    return {
      counter: null,
      isUnverified: false,
      error: "Invalid address format",
    };
  }

  const checksummed = getAddress(raw);

  // 4. Fetch On-Chain Metadata via Multicall & Verify Pool Liquidity
  try {
    const pub = createPublicOnlyBaseClient();
    const code = await pub.getCode({ address: checksummed });
    if (!code || code === "0x") {
      return {
        counter: null,
        isUnverified: false,
        error: "Address is not a contract on Base mainnet",
      };
    }

    const [nameRes, symRes, decRes, dexBatch] = await Promise.all([
      pub.readContract({
        address: checksummed,
        abi: ERC20_ABI,
        functionName: "name",
      }).catch(() => "Unknown Token"),
      pub.readContract({
        address: checksummed,
        abi: ERC20_ABI,
        functionName: "symbol",
      }).catch(() => "TOKEN"),
      pub.readContract({
        address: checksummed,
        abi: ERC20_ABI,
        functionName: "decimals",
      }).catch(() => 18),
      fetchDexScreenerBatch([checksummed]).catch(() => new Map()),
    ]);

    const symbol = String(symRes).trim().toUpperCase() || "TOKEN";
    const name = String(nameRes).trim() || symbol;
    const decimals = Number(decRes) || 18;

    const pairs = dexBatch.get(checksummed.toLowerCase()) ?? [];
    const best = pickBestPair(pairs);
    const tokenLiquidity = best?.liquidity?.usd;

    let verified = isVerifiedBaseToken(checksummed, { liquidityUsd: tokenLiquidity });
    if (tokenLiquidity && tokenLiquidity >= 100_000) {
      verified = true;
      registerVerifiedLiquidityToken(checksummed, tokenLiquidity);
    }

    const resolvedCounter: SwapCounter = {
      kind: "token",
      address: checksummed,
      symbol,
      decimals,
      isUnverified: !verified,
      isVerified: verified,
      name,
      liquidityUsd: tokenLiquidity,
    };

    return {
      counter: enrichSwapCounter(resolvedCounter),
      isUnverified: !verified,
    };
  } catch {
    return {
      counter: null,
      isUnverified: false,
      error: "Could not read token contract on Base RPC",
    };
  }
}

