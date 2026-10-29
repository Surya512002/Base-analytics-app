/**
 * Verified Base Tokens Registry & Verification Engine
 *
 * Single source of truth for verified Base mainnet tokens matching Coinbase Wallet verification standards:
 * - Official Coinbase Tokenized US Equities (RWAs) from TOKENIZED_STOCKS_REGISTRY (32 stocks)
 * - Curated High-MarketCap Base Bluechips & Major Currencies (ETH, WETH, USDC, cbBTC, cbETH, AERO, DEGEN, BRETT, TOSHI, VIRTUAL, etc.)
 *
 * Newly launched coins, unverified tokens, and general B20 vanity launches DO NOT receive the verified blue tickmark.
 */

import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import verifiedTokensJson from "./verified-base-tokens.json";

export interface VerifiedTokenDef {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  category?: "crypto" | "stock" | "b20";
  logoURI?: string | null;
}

/** Comprehensive list of 3,100+ Base catalog tokens from CoinGecko, Superchain, & Coinbase (used for asset discovery/pricing) */
export const ALL_VERIFIED_BASE_TOKENS: VerifiedTokenDef[] = verifiedTokensJson as VerifiedTokenDef[];

export const AERO_BASE_ADDRESS = "0x940181a94A35A4569E4529A3CDfB74e38FD98631" as const;
export const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

/**
 * Curated list of major Base mainnet high-marketcap bluechips & major currencies
 * matching Coinbase Wallet verified blue tick standard.
 */
export const VERIFIED_BASE_CRYPTO_TOKENS: VerifiedTokenDef[] = [
  // Major Base Currencies & Wrapped Assets
  { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", name: "USD Coin", decimals: 6, category: "crypto" },
  { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", name: "Wrapped Ether", decimals: 18, category: "crypto" },
  { address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", symbol: "cbBTC", name: "Coinbase Wrapped BTC", decimals: 8, category: "crypto" },
  { address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", symbol: "cbETH", name: "Coinbase Wrapped Staked ETH", decimals: 18, category: "crypto" },
  { address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", symbol: "wstETH", name: "Wrapped liquid staked Ether", decimals: 18, category: "crypto" },
  { address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", symbol: "AERO", name: "Aerodrome", decimals: 18, category: "crypto" },
  { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", symbol: "USDT", name: "Tether USD", decimals: 6, category: "crypto" },
  { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", name: "Dai Stablecoin", decimals: 18, category: "crypto" },
  { address: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42", symbol: "EURC", name: "Euro Coin", decimals: 6, category: "crypto" },
  { address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", symbol: "USDbC", name: "USD Base Coin", decimals: 6, category: "crypto" },
  { address: "0x820C137dD70085fC41C2e2bE20A84D4128A113a2", symbol: "USDS", name: "Sky Dollar", decimals: 18, category: "crypto" },

  // Base Ecosystem & DeFi Bluechips (Highest Market Cap)
  { address: "0xBAa5CC21fd487B8Fcc2F632f3F4E8D37262a0842", symbol: "MORPHO", name: "Morpho Token", decimals: 18, category: "crypto" },
  { address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", symbol: "DEGEN", name: "Degen", decimals: 18, category: "crypto" },
  { address: "0x532f27101965dd16442E59d40670FaF5eBB142E4", symbol: "BRETT", name: "Brett", decimals: 18, category: "crypto" },
  { address: "0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4", symbol: "TOSHI", name: "Toshi", decimals: 18, category: "crypto" },
  { address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", symbol: "VIRTUAL", name: "Virtual Protocol", decimals: 18, category: "crypto" },
  { address: "0x1111111111166b7FE7bd91427724B487980aFc69", symbol: "ZORA", name: "Zora", decimals: 18, category: "crypto" },
  { address: "0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe", symbol: "HIGHER", name: "Higher", decimals: 18, category: "crypto" },
  { address: "0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825", symbol: "AIXBT", name: "aixbt by Virtuals", decimals: 18, category: "crypto" },
  { address: "0xA88594D404727625A94370c984574b605991350a", symbol: "WELL", name: "Moonwell", decimals: 18, category: "crypto" },
  { address: "0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7", symbol: "AAVE", name: "Aave Token", decimals: 18, category: "crypto" },
  { address: "0x1C7a460413dD4e964f96D8dFC56E7223cE88CD85", symbol: "SEAM", name: "Seamless Protocol", decimals: 18, category: "crypto" },
  { address: "0x9e1028F5F1D5eDE59748FFceE5532509976840E0", symbol: "COMP", name: "Compound", decimals: 18, category: "crypto" },
  { address: "0x22e6966B79A72A50252875881477759a2C364AA7", symbol: "SNX", name: "Synthetix", decimals: 18, category: "crypto" },
  { address: "0x6fd9d7AD17242c41f7131d257212c54A0e816691", symbol: "UNI", name: "Uniswap", decimals: 18, category: "crypto" },
  { address: "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6", symbol: "LINK", name: "Chainlink", decimals: 18, category: "crypto" },
  { address: "0x9a26F5433671751c3276a26524315446141798A4", symbol: "KEYCAT", name: "Keyboard Cat", decimals: 18, category: "crypto" },
  { address: "0x8C9037D1Ef5c6D1f6816278C7AAF5491d24CD527", symbol: "MOXIE", name: "Moxie", decimals: 18, category: "crypto" },
  { address: "0x2D92B34A7538fC1959E758A698f567f4f79f123C", symbol: "PRIME", name: "Echelon Prime", decimals: 18, category: "crypto" },
  { address: "0x9A33406165f57cbD54C7D03d360EF3Eb8c6c9A35", symbol: "TALENT", name: "Talent Protocol", decimals: 18, category: "crypto" },
  { address: "0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb", symbol: "CLANKER", name: "tokenbot", decimals: 18, category: "crypto" },
  { address: "0xB4fDe59a779991bfB6a52253B51947828b982be3", symbol: "PEPE", name: "Based Pepe", decimals: 18, category: "crypto" },
  { address: "0xcbD06E5A2B0C65597161de254AA074E489dEb510", symbol: "CBDOGE", name: "Coinbase Doge", decimals: 18, category: "crypto" },
  { address: "0xFCa95aeb5bF44aE355806A5ad14659c940dC6BF7", symbol: "SHIB", name: "Shiba Inu", decimals: 18, category: "crypto" },
  { address: "0xE3086852A4B125803C815a158249ae468A3254Ca", symbol: "MFER", name: "mfercoin", decimals: 18, category: "crypto" },
  { address: "0x0d97F261b1e88845184f678e2d1e7a98D9FD38dE", symbol: "TYBG", name: "Base God", decimals: 18, category: "crypto" },
];

/**
 * Pre-computed lookup set of official Blue-Check verified token addresses (lowercase)
 * Matching Coinbase Wallet standards:
 * 1. Official Coinbase Tokenized US Equities (32 stocks from TOKENIZED_STOCKS_REGISTRY)
 * 2. Curated High-MarketCap Base Bluechips and Major Currencies (VERIFIED_BASE_CRYPTO_TOKENS)
 * 3. Native ETH
 */
export const BLUE_CHECK_VERIFIED_ADDRESS_SET = new Set<string>([
  "eth",
  "0x0000000000000000000000000000000000000000",
  ...TOKENIZED_STOCKS_REGISTRY.map((s) => s.address.toLowerCase()),
  ...VERIFIED_BASE_CRYPTO_TOKENS.map((t) => t.address.toLowerCase()),
]);

export const BLUE_CHECK_VERIFIED_SYMBOL_SET = new Set<string>([
  "ETH",
  "WETH",
  ...TOKENIZED_STOCKS_REGISTRY.map((s) => s.symbol.toUpperCase()),
  ...VERIFIED_BASE_CRYPTO_TOKENS.map((t) => t.symbol.toUpperCase()),
]);

/**
 * Fast lookup for a catalog token by address or symbol
 */
export function findVerifiedToken(addressOrSymbol: string): VerifiedTokenDef | undefined {
  const raw = addressOrSymbol.trim().toLowerCase();
  return (
    VERIFIED_BASE_CRYPTO_TOKENS.find(
      (t) => t.address.toLowerCase() === raw || t.symbol.toLowerCase() === raw
    ) ||
    ALL_VERIFIED_BASE_TOKENS.find(
      (t) => t.address.toLowerCase() === raw || t.symbol.toLowerCase() === raw
    )
  );
}

/**
 * Searches across all 3,100+ Base catalog tokens by symbol, name, or address
 */
export function searchVerifiedTokens(query: string, limit = 50): VerifiedTokenDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: VerifiedTokenDef[] = [];
  const seen = new Set<string>();

  for (const t of ALL_VERIFIED_BASE_TOKENS) {
    const addr = t.address.toLowerCase();
    if (seen.has(addr)) continue;
    if (
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      addr === q
    ) {
      seen.add(addr);
      results.push(t);
      if (results.length >= limit) break;
    }
  }
  return results;
}

/**
 * Minimum locked pool liquidity threshold ($100,000 USD)
 * Tokens with >= $100k locked DEX liquidity receive the verified blue checkmark.
 */
export const VERIFIED_LIQUIDITY_USD_THRESHOLD = 100_000;

/** Dynamic set of tokens confirmed to have >= $100k locked pool liquidity */
export const DYNAMIC_VERIFIED_LIQUIDITY_ADDRESS_SET = new Set<string>();

/**
 * Register a token address into the verified set if it meets the $100k liquidity threshold.
 */
export function registerVerifiedLiquidityToken(address: string, liquidityUsd: number): boolean {
  if (liquidityUsd >= VERIFIED_LIQUIDITY_USD_THRESHOLD) {
    DYNAMIC_VERIFIED_LIQUIDITY_ADDRESS_SET.add(address.toLowerCase());
    return true;
  }
  return false;
}

/**
 * Checks whether an address, SwapCounter, UnifiedToken, or symbol is verified on Base
 * with the verified blue checkmark.
 *
 * Blue Checkmark criteria:
 * 1. Official Base Tokenized US Equities (RWAs) from TOKENIZED_STOCKS_REGISTRY (265+ stocks)
 * 2. Curated High-MarketCap Base Bluechips and Currencies (VERIFIED_BASE_CRYPTO_TOKENS & ETH)
 * 3. Tokens with >= $100k locked DEX pool liquidity (verified via liquidityUsd or dynamic discovery)
 */
export function isVerifiedBaseToken(
  tokenOrAddress?:
    | string
    | SwapCounter
    | UnifiedToken
    | { address?: string; liquidityUsd?: number | null; isVerified?: boolean }
    | null,
  options?: { liquidityUsd?: number | null }
): boolean {
  if (!tokenOrAddress) return false;

  // Direct option liquidity check ($100k threshold)
  if (options?.liquidityUsd != null && options.liquidityUsd >= VERIFIED_LIQUIDITY_USD_THRESHOLD) {
    if (typeof tokenOrAddress === "string" && tokenOrAddress.startsWith("0x")) {
      DYNAMIC_VERIFIED_LIQUIDITY_ADDRESS_SET.add(tokenOrAddress.toLowerCase());
    }
    return true;
  }

  // 1. SwapCounter, UnifiedToken, or token object with metadata
  if (typeof tokenOrAddress === "object") {
    // If explicitly marked as verified
    if ("isVerified" in tokenOrAddress && tokenOrAddress.isVerified === true) {
      return true;
    }

    // Check liquidity on the object itself ($100k+ threshold)
    if ("liquidityUsd" in tokenOrAddress && typeof tokenOrAddress.liquidityUsd === "number") {
      if (tokenOrAddress.liquidityUsd >= VERIFIED_LIQUIDITY_USD_THRESHOLD) {
        if ("address" in tokenOrAddress && tokenOrAddress.address) {
          DYNAMIC_VERIFIED_LIQUIDITY_ADDRESS_SET.add(tokenOrAddress.address.toLowerCase());
        }
        return true;
      }
    }

    if ("kind" in tokenOrAddress) {
      if (tokenOrAddress.kind === "eth") return true;
      if (tokenOrAddress.address) {
        const addr = tokenOrAddress.address.toLowerCase();
        return (
          BLUE_CHECK_VERIFIED_ADDRESS_SET.has(addr) ||
          DYNAMIC_VERIFIED_LIQUIDITY_ADDRESS_SET.has(addr)
        );
      }
      return false;
    }

    // UnifiedToken / generic token object
    if ("address" in tokenOrAddress && tokenOrAddress.address) {
      const addr = tokenOrAddress.address.toLowerCase();
      return (
        BLUE_CHECK_VERIFIED_ADDRESS_SET.has(addr) ||
        DYNAMIC_VERIFIED_LIQUIDITY_ADDRESS_SET.has(addr)
      );
    }
    return false;
  }

  // 2. String address or sentinel or symbol
  const raw = tokenOrAddress.trim().toLowerCase();
  if (raw === "eth" || raw === "0x0000000000000000000000000000000000000000") {
    return true;
  }

  // Check dynamic verified liquidity registry
  if (DYNAMIC_VERIFIED_LIQUIDITY_ADDRESS_SET.has(raw)) {
    return true;
  }

  // Check by contract address
  if (raw.startsWith("0x")) {
    return BLUE_CHECK_VERIFIED_ADDRESS_SET.has(raw);
  }

  // If a known bluechip symbol is queried alone (e.g. "USDC", "WETH", "NVDAc", "AERO")
  if (BLUE_CHECK_VERIFIED_SYMBOL_SET.has(raw.toUpperCase())) {
    return true;
  }

  return false;
}
