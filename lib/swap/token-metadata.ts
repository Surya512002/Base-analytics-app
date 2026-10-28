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
 * Resolve token by address or symbol ("eth")
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
    return { counter: ETH_COUNTER, isUnverified: false };
  }

  if (!isAddress(raw)) {
    return {
      counter: null,
      isUnverified: false,
      error: "Invalid address format",
    };
  }

  const checksummed = getAddress(raw);

  // 2. Check Curated Common Base Tokens
  const commonMatch = COMMON_BASE_TOKENS.find(
    (t) => t.address.toLowerCase() === raw
  );
  if (commonMatch) {
    return {
      counter: enrichSwapCounter(commonTokenToCounter(commonMatch)),
      isUnverified: false,
    };
  }

  // 3. Check Tokenized Stocks Registry
  const stockMatch = TOKENIZED_STOCKS_REGISTRY.find(
    (s) => s.address.toLowerCase() === raw
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
    return {
      counter: enrichSwapCounter(commonTokenToCounter(commonStock)),
      isUnverified: false,
    };
  }

  // 4. Fetch On-Chain Metadata via Multicall
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

    const [nameRes, symRes, decRes] = await Promise.all([
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
    ]);

    const symbol = String(symRes).trim().toUpperCase() || "TOKEN";
    const name = String(nameRes).trim() || symbol;
    const decimals = Number(decRes) || 18;

    const unverifiedCounter: SwapCounter = {
      kind: "token",
      address: checksummed,
      symbol,
      decimals,
      isUnverified: true,
      name,
    };

    return {
      counter: enrichSwapCounter(unverifiedCounter),
      isUnverified: true,
    };
  } catch {
    return {
      counter: null,
      isUnverified: false,
      error: "Could not read token contract on Base RPC",
    };
  }
}
