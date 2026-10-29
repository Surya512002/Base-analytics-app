import { parseAbi } from "viem";
import { createBasePublicClient } from "../utils/base-rpc";
import { TOKENIZED_STOCKS_REGISTRY } from "../stocks/tokenized-stocks-registry";
import { fetchDexScreenerBatch, pickBestPair } from "../launchpad/dexscreener";
import type { PriceSource } from "./types";

const CHAINLINK_AGGREGATOR_ABI = parseAbi([
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() external view returns (uint8)",
]);

// Official Base mainnet Chainlink feeds
const CHAINLINK_ETH_USD_BASE = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70" as const;

// Pegged assets dictionary
const PEGGED_PRICES: Record<string, number> = {
  // USD Stables
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": 1.0, // USDC
  "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": 1.0, // USDbC
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": 1.0, // USDT
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": 1.0, // DAI
  "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42": 1.08, // EURC
};

export interface PriceResult {
  priceUsd: number | null;
  priceSource: PriceSource;
  priceChange24h: number | null;
  liquidityUsd?: number | null;
  hasPool?: boolean;
}

/** Map of token address (lowercase) to Chainlink feed address */
const STOCK_FEEDS_BY_ADDRESS = new Map<string, `0x${string}`>();
for (const stock of TOKENIZED_STOCKS_REGISTRY) {
  if (stock.priceFeed?.address) {
    STOCK_FEEDS_BY_ADDRESS.set(stock.address.toLowerCase(), stock.priceFeed.address as `0x${string}`);
  }
}

/**
 * Fetch prices for a list of token addresses on Base.
 * Priority order:
 * 1. Chainlink Feeds (Tokenized stocks, ETH, cbBTC)
 * 2. Pegged constants for verified stablecoins
 * 3. DefiLlama Price API (Base tokens)
 * 4. DexScreener API with liquidity validation (ignoring pools < $500 liquidity)
 */
export async function batchPriceTokens(
  tokenAddresses: Array<`0x${string}` | null>
): Promise<Map<string, PriceResult>> {
  const results = new Map<string, PriceResult>();
  const client = createBasePublicClient();

  // Distinct non-null lowercase addresses
  const erc20Addresses: `0x${string}`[] = [];
  let hasEth = false;

  for (const addr of tokenAddresses) {
    if (!addr) {
      hasEth = true;
      continue;
    }
    const lower = addr.toLowerCase();
    if (!results.has(lower)) {
      erc20Addresses.push(addr);
      // Initialize with unpriced
      results.set(lower, {
        priceUsd: null,
        priceSource: "none",
        priceChange24h: null,
      });
    }
  }

  // 1. Fetch ETH Price from Chainlink (feed 0x7104... with 8 decimals)
  let ethPriceUsd = 2500;
  try {
    const [, answer] = await client.readContract({
      address: CHAINLINK_ETH_USD_BASE,
      abi: CHAINLINK_AGGREGATOR_ABI,
      functionName: "latestRoundData",
    });
    if (answer > BigInt(0)) {
      ethPriceUsd = Number(answer) / 1e8;
    }
  } catch {
    // Fallback ETH price fetch from DefiLlama
    try {
      const r = await fetch("https://coins.llama.fi/prices/current/coingecko:ethereum", {
        signal: AbortSignal.timeout(3_000),
      });
      if (r.ok) {
        const d = (await r.json()) as { coins?: { [key: string]: { price?: number } } };
        const p = d.coins?.["coingecko:ethereum"]?.price;
        if (p && p > 0) ethPriceUsd = p;
      }
    } catch {
      // Keep fallback
    }
  }

  if (hasEth) {
    results.set("eth", {
      priceUsd: ethPriceUsd,
      priceSource: "chainlink",
      priceChange24h: null,
    });
  }

  // WETH address pegged to ETH price
  const wethAddr = "0x4200000000000000000000000000000000000006";
  if (results.has(wethAddr)) {
    results.set(wethAddr, {
      priceUsd: ethPriceUsd,
      priceSource: "chainlink",
      priceChange24h: null,
    });
  }

  // 2. Check Pegged Assets
  for (const addr of erc20Addresses) {
    const lower = addr.toLowerCase();
    if (PEGGED_PRICES[lower] !== undefined) {
      results.set(lower, {
        priceUsd: PEGGED_PRICES[lower]!,
        priceSource: "pegged",
        priceChange24h: 0,
      });
    }
  }

  // 3. Chainlink Feeds for Tokenized Stocks
  const stockFeedCalls: { address: `0x${string}`; feed: `0x${string}` }[] = [];
  for (const addr of erc20Addresses) {
    const lower = addr.toLowerCase();
    const feed = STOCK_FEEDS_BY_ADDRESS.get(lower);
    if (feed) {
      stockFeedCalls.push({ address: addr, feed });
    }
  }

  if (stockFeedCalls.length > 0) {
    try {
      const feedResults = await client.multicall({
        contracts: stockFeedCalls.map((item) => ({
          address: item.feed,
          abi: CHAINLINK_AGGREGATOR_ABI,
          functionName: "latestRoundData" as const,
        })),
      });

      for (let i = 0; i < stockFeedCalls.length; i++) {
        const item = stockFeedCalls[i]!;
        const res = feedResults[i];
        if (res && res.status === "success" && Array.isArray(res.result)) {
          const answer = res.result[1] as bigint;
          if (answer > BigInt(0)) {
            const price = Number(answer) / 1e8;
            results.set(item.address.toLowerCase(), {
              priceUsd: price,
              priceSource: "chainlink",
              priceChange24h: null,
            });
          }
        }
      }
    } catch {
      // Continue to next providers on multicall error
    }
  }

  // Filter remaining addresses needing pricing
  const remainingAddresses = erc20Addresses.filter(
    (addr) => results.get(addr.toLowerCase())?.priceUsd == null
  );

  if (remainingAddresses.length === 0) {
    return results;
  }

  // 4. DefiLlama Price API Batch Lookup
  try {
    const llamaCoins = remainingAddresses.map((a) => `base:${a}`).join(",");
    const llamaRes = await fetch(`https://coins.llama.fi/prices/current/${llamaCoins}`, {
      signal: AbortSignal.timeout(4_000),
    });

    if (llamaRes.ok) {
      const llamaData = (await llamaRes.json()) as {
        coins?: Record<string, { price?: number; timestamp?: number }>;
      };
      if (llamaData.coins) {
        const llamaMap = new Map<string, number>();
        for (const [key, val] of Object.entries(llamaData.coins)) {
          const cleanKey = key.toLowerCase().replace(/^base:/i, "");
          if (val?.price && val.price > 0 && Number.isFinite(val.price)) {
            llamaMap.set(cleanKey, val.price);
          }
        }

        for (const addr of remainingAddresses) {
          const lower = addr.toLowerCase();
          const price = llamaMap.get(lower);
          if (price != null && price > 0) {
            results.set(lower, {
              priceUsd: price,
              priceSource: "defillama",
              priceChange24h: null,
            });
          }
        }
      }
    }
  } catch {
    // Proceed to DexScreener
  }

  // 5. DexScreener API with Liquidity Threshold (ignore pools < $500)
  // Query all ERC-20 tokens needing prices or liquidity stats
  const tokensForDex = erc20Addresses.filter((addr) => {
    const existing = results.get(addr.toLowerCase());
    return existing?.priceUsd == null || existing.liquidityUsd == null;
  });

  if (tokensForDex.length > 0) {
    try {
      const dexBatch = await fetchDexScreenerBatch(tokensForDex);
      for (const addr of tokensForDex) {
        const lower = addr.toLowerCase();
        const pairs = dexBatch.get(lower);
        if (pairs && pairs.length > 0) {
          const best = pickBestPair(pairs);
          const liquidity = best?.liquidity?.usd ?? 0;
          const hasPool = Boolean(best);
          const existing = results.get(lower);

          // If token not yet priced, set price from DexScreener if liquidity passes threshold ($500)
          if (existing?.priceUsd == null && best?.priceUsd && liquidity >= 500) {
            const price = parseFloat(best.priceUsd);
            if (price > 0 && Number.isFinite(price)) {
              results.set(lower, {
                priceUsd: price,
                priceSource: "dexscreener",
                priceChange24h: best.priceChange?.h24 ?? null,
                liquidityUsd: liquidity,
                hasPool: true,
              });
              continue;
            }
          }

          // Otherwise enrich liquidity & 24h change onto existing price
          results.set(lower, {
            priceUsd: existing?.priceUsd ?? null,
            priceSource: existing?.priceSource ?? "none",
            priceChange24h: existing?.priceChange24h ?? best?.priceChange?.h24 ?? null,
            liquidityUsd: liquidity,
            hasPool,
          });
        }
      }
    } catch {
      // Ignore DexScreener failures
    }
  }

  return results;
}
