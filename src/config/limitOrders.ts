/**
 * Limit Order Book Configuration for Base Analytics
 *
 * Verified against official deployment documentation and live on-chain state:
 * - Native USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (Circle Official Docs: https://developers.circle.com/stablecoins/usdc-on-mainnet)
 * - Uniswap V3 SwapRouter02 on Base: 0x2626664c2603336E57B271c5C0b26F421741e481 (Uniswap Official Docs: https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments)
 * - Chainlink USD feeds on Base: 8 decimals, 0.5% deviation threshold, 86400s heartbeat (Chainlink Official: data.chain.link)
 * - Tokenized Stocks on Base: Coinbase Tokenized Stocks (Base Official: https://www.base.org/stocks & lib/stocks/tokenized-stocks-registry.ts)
 */

import { getAddress, type Address } from "viem";

export interface StockMarketConfig {
  stockToken: Address;
  symbol: string;
  name: string;
  decimals: number;
  feed: Address;
  poolFee: number; // Uniswap V3 fee tier e.g. 3000 (0.3%)
  maxStalenessSeconds: number;
  maxStockIn?: bigint;
  maxQuoteIn?: bigint;
  maxDeviationBps?: number;
  logo?: string;
  category?: string;
}

export interface QuoteTokenConfig {
  address: Address;
  symbol: string;
  decimals: number;
}

export interface LimitOrdersConfig {
  orderBook: Address;
  swapAdapter: Address;
  quoteToken: QuoteTokenConfig;
  markets: StockMarketConfig[];
  defaultMaxDeviationBps: number;
  defaultKeeperFeeBps: number;
  maxStockIn: bigint;
  maxQuoteIn: bigint;
}

// Verified native USDC on Base (Circle official)
export const USDC_BASE_ADDRESS = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");

// Verified Uniswap V3 SwapRouter02 on Base (Uniswap official)
export const UNISWAP_V3_ROUTER02_BASE = getAddress("0x2626664c2603336E57B271c5C0b26F421741e481");

/**
 * 300 bps (3.0%) MAX_DEVIATION_BPS rationale:
 * Tokenized equities on Base DEX pools trade with slightly wider spreads than high-liquidity crypto pairs.
 * Setting deviation too tight (<1.5%) causes false reverts on stop-loss executions during market open gaps.
 * 300 bps balances strict front-running protection with guaranteed fill execution.
 */
export const DEFAULT_MAX_DEVIATION_BPS = 300;
export const DEFAULT_KEEPER_FEE_BPS = 10; // 0.10%

/**
 * 90,000s (25 hours) maxStaleness rationale:
 * Chainlink equity feeds on Base have an 86,400s (24h) heartbeat and a 0.5% deviation threshold.
 * Setting maxStaleness to 3600s would falsely revert every order during low-volatility trading days.
 * 90,000s provides a 1-hour grace window over the 24h heartbeat for OCR network propagation while
 * safely halting execution over weekend market closures.
 */
export const EQUITY_MAX_STALENESS_SECONDS = 90000;

/** Verified markets on Base Mainnet (Chain ID 8453) with active single-hop Uniswap V3 USDC pools */
export const BASE_MAINNET_MARKETS: StockMarketConfig[] = [
  {
    symbol: "NVDAc",
    name: "NVIDIA Corp (Coinbase)",
    stockToken: getAddress("0xb20000000000000000000078ee7ce2fe4908108c"),
    decimals: 8,
    // Chainlink Coinbase NVDA / USD Feed (0.5% deviation, 86400s heartbeat)
    feed: getAddress("0x04689a41629776563E6822F76f2e57D148d28513"),
    // Uniswap V3 USDC pool 0x60661b315553EB81872deEA9a66d567Cf0CCd33B
    poolFee: 3000,
    maxStalenessSeconds: EQUITY_MAX_STALENESS_SECONDS,
    maxStockIn: 100_000_000n, // 1.0 whole stock (~$188 cap)
    maxQuoteIn: 100_000_000n, // 100 USDC ($100 cap)
    category: "Tech",
    logo: "https://metadata.coinbase.com/equity_icons/1fee9b7a44e800d438dd9d96c3283e05784c925c2c871a48ff735950740b551a.png",
  },
  {
    symbol: "AAPLc",
    name: "Apple Inc (Coinbase)",
    stockToken: getAddress("0xb200000000000000000000c2e324d24d7eecd1fb"),
    decimals: 8,
    // Chainlink Coinbase AAPL / USD Feed (0.5% deviation, 86400s heartbeat)
    feed: getAddress("0x787f13dEa48Db0897CbCDD985de77809D837F988"),
    // Uniswap V3 USDC pool 0x97F35d1E92795327614BE000cd18cba1Be2c1931
    poolFee: 3000,
    maxStalenessSeconds: EQUITY_MAX_STALENESS_SECONDS,
    maxStockIn: 50_000_000n, // 0.5 whole stock (~$171 cap)
    maxQuoteIn: 100_000_000n, // 100 USDC ($100 cap)
    category: "Tech",
    logo: "https://metadata.coinbase.com/equity_icons/873819f4b14efe44b94abecbc8e8864d2998163abd0ca55b449ee6eb07d0d94c.png",
  },
  {
    symbol: "MSFTc",
    name: "Microsoft Corporation (Coinbase)",
    stockToken: getAddress("0xb200000000000000000000ab99cfa739e253872b"),
    decimals: 8,
    // Chainlink Coinbase MSFT / USD Feed (0.5% deviation, 86400s heartbeat)
    feed: getAddress("0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c"),
    // Uniswap V3 USDC pool 0xD73cBeCC0F62C7C1704332ED119514d6d84DC607
    poolFee: 10000,
    maxStalenessSeconds: EQUITY_MAX_STALENESS_SECONDS,
    maxDeviationBps: 350,
    maxStockIn: 25_000_000n, // 0.25 whole stock (~$133 cap)
    maxQuoteIn: 100_000_000n, // 100 USDC ($100 cap)
    category: "Tech",
    logo: "https://metadata.coinbase.com/equity_icons/e90930ade985016f48816c6bd9fd1e8274b28507f4833881b3a16c77c2a3e2e7.png",
  },
  {
    symbol: "GOOGLc",
    name: "Alphabet Inc (Coinbase)",
    stockToken: getAddress("0xb2000000000000000000002d0ba3164cc74f58b7"),
    decimals: 8,
    // Chainlink Coinbase GOOGL / USD Feed (0.5% deviation, 86400s heartbeat)
    feed: getAddress("0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2"),
    // Uniswap V3 USDC pool 0x8634EE4145A63E40E44e12A6Bb1B905Fcb8856a6
    poolFee: 3000,
    maxStalenessSeconds: EQUITY_MAX_STALENESS_SECONDS,
    maxStockIn: 50_000_000n, // 0.5 whole stock (~$143 cap)
    maxQuoteIn: 100_000_000n, // 100 USDC ($100 cap)
    category: "Tech",
    logo: "https://metadata.coinbase.com/equity_icons/0e80e31df40f7c42b49a3c7f6d23c6351625d73f235aeb69006ddee9221702b0.png",
  },
];

/** Base Sepolia Testnet Mock Config (Chain ID 84532) */
export const BASE_SEPOLIA_CONFIG: LimitOrdersConfig = {
  orderBook: (process.env.NEXT_PUBLIC_LIMIT_ORDER_BOOK_SEPOLIA as Address) ||
    getAddress("0xC7fBA8EB5442760F83266C32F3Bc2E5c65079e46"),
  swapAdapter: (process.env.NEXT_PUBLIC_LIMIT_ORDER_ADAPTER_SEPOLIA as Address) ||
    getAddress("0xbDa98551b18431bD95fdF21D06cBc37dA9dE943D"),
  quoteToken: {
    address: (process.env.NEXT_PUBLIC_LIMIT_ORDER_QUOTE_SEPOLIA as Address) ||
      getAddress("0x19468e9fe5dBfdbD786D9b09Da7caC07c1367187"),
    symbol: "mUSDC",
    decimals: 6,
  },
  markets: [
    {
      symbol: "mNVDA",
      name: "Mock NVDA (Testnet)",
      stockToken: (process.env.NEXT_PUBLIC_LIMIT_ORDER_STOCK_SEPOLIA as Address) ||
        getAddress("0xCCc66590BA8a67fe51bC2eB552B24f30c30263F2"),
      decimals: 18,
      feed: (process.env.NEXT_PUBLIC_LIMIT_ORDER_FEED_SEPOLIA as Address) ||
        getAddress("0x8836DF0Aa5F499B8E53649e6662EBE1C668F767f"),
      poolFee: 3000,
      maxStalenessSeconds: 86400 * 7,
      maxStockIn: 1n * 10n ** 18n, // 1 mNVDA ($100 cap)
      maxQuoteIn: 100n * 10n ** 6n, // 100 mUSDC ($100 cap)
      category: "Testnet",
    },
  ],
  defaultMaxDeviationBps: 500,
  defaultKeeperFeeBps: 10,
  maxStockIn: 1n * 10n ** 18n,
  maxQuoteIn: 100n * 10n ** 6n,
};

/** Base Mainnet Config (Chain ID 8453) */
export const BASE_MAINNET_CONFIG: LimitOrdersConfig = {
  orderBook: (process.env.NEXT_PUBLIC_LIMIT_ORDER_BOOK_MAINNET as Address) ||
    (process.env.NEXT_PUBLIC_LIMIT_ORDER_BOOK as Address) ||
    getAddress("0x0000000000000000000000000000000000000000"),
  swapAdapter: (process.env.NEXT_PUBLIC_LIMIT_ORDER_ADAPTER_MAINNET as Address) ||
    getAddress("0x0000000000000000000000000000000000000000"),
  quoteToken: {
    address: USDC_BASE_ADDRESS,
    symbol: "USDC",
    decimals: 6,
  },
  markets: BASE_MAINNET_MARKETS,
  defaultMaxDeviationBps: DEFAULT_MAX_DEVIATION_BPS,
  defaultKeeperFeeBps: DEFAULT_KEEPER_FEE_BPS,
  // Beta caps: small ~$100 limits per order & per DCA plan
  maxStockIn: 100_000_000n, // 1.0 whole stock (~$188)
  maxQuoteIn: 100_000_000n, // 100 USDC ($100)
};

/** Get configuration for active chain */
export function getLimitOrdersConfig(chainId?: number): LimitOrdersConfig {
  if (chainId === 84532) {
    return BASE_SEPOLIA_CONFIG;
  }
  return BASE_MAINNET_CONFIG;
}
