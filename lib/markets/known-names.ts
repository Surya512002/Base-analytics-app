import { VERIFIED_BASE_CRYPTO_TOKENS } from "@/lib/swap/verified-tokens";
import { USDC_BASE } from "@/lib/launchpad/tokens-base";
import type { MarketItem } from "@/lib/markets/board";

/**
 * Guards the market list against look-alikes: well-known tokens show their verified names, and any
 * other token borrowing a stock's or a well-known token's ticker is left out. USDC is what people
 * pay with, so it is not listed as a market.
 */
export function borrowedNameFilter(stockSymbols: string[], add: (item: MarketItem) => void) {
  const known = new Map(VERIFIED_BASE_CRYPTO_TOKENS.map((t) => [t.address.toLowerCase(), t]));
  const taken = new Set([...stockSymbols, ...VERIFIED_BASE_CRYPTO_TOKENS.map((t) => t.symbol)].map((s) => s.toUpperCase()));
  return (item: MarketItem) => {
    const key = item.address.toLowerCase();
    if (key === USDC_BASE.toLowerCase()) return;
    if (item.kind === "stock") return add(item);
    const real = known.get(key);
    if (real) return add({ ...item, symbol: real.symbol, name: real.name, decimals: real.decimals });
    if (!taken.has(item.symbol.toUpperCase())) add(item);
  };
}
