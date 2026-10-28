/**
 * Verified Base Tokens Registry & Verification Engine
 *
 * Single source of truth for verified Base mainnet tokens matching Coinbase Wallet verification standards:
 * - Curated Base ecosystem tokens (AERO, USDC, cbBTC, cbETH, WETH, MORPHO, DEGEN, VIRTUAL, etc.)
 * - All 32 Coinbase Tokenized US Equities (RWAs) from TOKENIZED_STOCKS_REGISTRY
 * - All official B20 Vanity tokens deployed on Base
 */

import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import type { UnifiedToken } from "@/lib/explore/explore-types";

export interface VerifiedTokenDef {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  category: "crypto" | "stock" | "b20";
}

export const AERO_BASE_ADDRESS = "0x940181a94A35A4569E4529A3CDfB74e38FD98631" as const;
export const USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

/**
 * Curated list of major Base mainnet tokens verified on Coinbase Wallet & Base official bridge
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

  // Base Ecosystem & DeFi Bluechips
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
];

/**
 * Pre-computed lookup set of all verified token addresses (lowercase)
 */
const VERIFIED_ADDRESS_SET = new Set<string>([
  "eth",
  "0x0000000000000000000000000000000000000000",
  ...VERIFIED_BASE_CRYPTO_TOKENS.map((t) => t.address.toLowerCase()),
  ...TOKENIZED_STOCKS_REGISTRY.map((s) => s.address.toLowerCase()),
]);

const VERIFIED_SYMBOL_SET = new Set<string>([
  "ETH",
  "WETH",
  ...VERIFIED_BASE_CRYPTO_TOKENS.map((t) => t.symbol.toUpperCase()),
  ...TOKENIZED_STOCKS_REGISTRY.map((s) => s.symbol.toUpperCase()),
]);

/**
 * Checks whether an address, SwapCounter, UnifiedToken, or symbol is verified on Base.
 */
export function isVerifiedBaseToken(
  tokenOrAddress?: string | SwapCounter | UnifiedToken | null
): boolean {
  if (!tokenOrAddress) return false;

  // 1. SwapCounter object
  if (typeof tokenOrAddress === "object") {
    if ("kind" in tokenOrAddress) {
      if (tokenOrAddress.kind === "eth") return true;
      if (tokenOrAddress.isVerified === true) return true;
      const addr = tokenOrAddress.address?.toLowerCase();
      if (addr) {
        if (VERIFIED_ADDRESS_SET.has(addr) || addr.startsWith("0xb20")) return true;
      }
      if (tokenOrAddress.symbol && VERIFIED_SYMBOL_SET.has(tokenOrAddress.symbol.toUpperCase())) {
        return true;
      }
      return false;
    }
    // UnifiedToken
    if ("address" in tokenOrAddress && tokenOrAddress.address) {
      const addr = tokenOrAddress.address.toLowerCase();
      if (VERIFIED_ADDRESS_SET.has(addr) || addr.startsWith("0xb20")) return true;
      if (tokenOrAddress.symbol && VERIFIED_SYMBOL_SET.has(tokenOrAddress.symbol.toUpperCase())) {
        return true;
      }
      if (tokenOrAddress.type === "stock" || tokenOrAddress.type === "b20") return true;
    }
    return false;
  }

  // 2. String address or sentinel
  const raw = tokenOrAddress.trim().toLowerCase();
  if (raw === "eth" || raw === "0x0000000000000000000000000000000000000000") {
    return true;
  }

  if (VERIFIED_ADDRESS_SET.has(raw)) {
    return true;
  }

  if (raw.startsWith("0xb20")) {
    return true;
  }

  if (VERIFIED_SYMBOL_SET.has(raw.toUpperCase())) {
    return true;
  }

  return false;
}
