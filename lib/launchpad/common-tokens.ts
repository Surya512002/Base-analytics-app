/**
 * Starting set for the swap token picker.
 *
 * This is a convenience shortlist, not the tradeable universe — any Base ERC-20
 * can be pasted in and resolved on-chain. Every entry below was read straight
 * from its contract on Base mainnet, so symbols and decimals are authoritative
 * (cbBTC really is 8, USDC/EURC/USDT are 6).
 */
import { TOKENIZED_STOCKS_REGISTRY, type StockCategory } from "@/lib/stocks/tokenized-stocks-registry";

export type CommonToken = {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  category?: "crypto" | "stock";
  stockCategory?: StockCategory;
  underlyingTicker?: string;
};

export const CRYPTO_BASE_TOKENS: CommonToken[] = [
  // Crypto Major & DeFi
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
  { address: "0xBAa5CC21fd487B8Fcc2F632f3F4E8D37262a0842", symbol: "MORPHO", name: "Morpho Token", decimals: 18, category: "crypto" },
  { address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", symbol: "DEGEN", name: "Degen", decimals: 18, category: "crypto" },
  { address: "0x532f27101965dd16442E59d40670FaF5eBB142E4", symbol: "BRETT", name: "Brett", decimals: 18, category: "crypto" },
  { address: "0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4", symbol: "TOSHI", name: "Toshi", decimals: 18, category: "crypto" },
  { address: "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", symbol: "VIRTUAL", name: "Virtual Protocol", decimals: 18, category: "crypto" },
  { address: "0x1111111111166b7FE7bd91427724B487980aFc69", symbol: "ZORA", name: "Zora", decimals: 18, category: "crypto" },
  { address: "0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe", symbol: "HIGHER", name: "Higher", decimals: 18, category: "crypto" },
];

/**
 * All 32 Tokenized Equities from single-source-of-truth registry
 */
export const COMMON_STOCK_TOKENS: CommonToken[] = TOKENIZED_STOCKS_REGISTRY.map((s) => ({
  address: s.address,
  symbol: s.symbol,
  name: s.name,
  decimals: s.decimals,
  category: "stock" as const,
  stockCategory: s.category,
  underlyingTicker: s.underlyingTicker,
}));

export const COMMON_BASE_TOKENS: CommonToken[] = [
  ...CRYPTO_BASE_TOKENS,
  ...COMMON_STOCK_TOKENS,
];

export function findCommonToken(address: string): CommonToken | null {
  const needle = address.trim().toLowerCase();
  return (
    COMMON_BASE_TOKENS.find((t) => t.address.toLowerCase() === needle) ?? null
  );
}

export function searchCommonTokens(
  query: string,
  category: "all" | "crypto" | "stock" = "all"
): CommonToken[] {
  const q = query.trim().toLowerCase();
  let base = COMMON_BASE_TOKENS;
  if (category !== "all") {
    base = base.filter((t) => (t.category ?? "crypto") === category);
  }
  if (!q) return base;
  return base.filter(
    (t) =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q)
  );
}
