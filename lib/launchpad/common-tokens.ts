/**
 * Starting set for the swap token picker.
 *
 * This is a convenience shortlist, not the tradeable universe — any Base ERC-20
 * can be pasted in and resolved on-chain. Every entry below was read straight
 * from its contract on Base mainnet, so symbols and decimals are authoritative
 * (cbBTC really is 8, USDC/EURC/USDT are 6).
 */
import { TOKENIZED_STOCKS_REGISTRY, type StockCategory } from "@/lib/stocks/tokenized-stocks-registry";
import { VERIFIED_BASE_CRYPTO_TOKENS, isVerifiedBaseToken } from "@/lib/swap/verified-tokens";

export { isVerifiedBaseToken };

export type CommonToken = {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  category?: "crypto" | "stock" | "b20";
  stockCategory?: StockCategory;
  underlyingTicker?: string;
};

export const CRYPTO_BASE_TOKENS: CommonToken[] = VERIFIED_BASE_CRYPTO_TOKENS;


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
