type TokenLike =
  | { kind: "eth" }
  | {
      kind: "token";
      address: string;
      symbol: string;
      decimals: number;
      imageUrl?: string;
    };

/** Well-known Base token logos (CoinGecko CDN — fast & stable). */
const KNOWN_LOGO: Record<string, string> = {
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913":
    "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  "0x4200000000000000000000000000000000000006":
    "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf":
    "https://assets.coingecko.com/coins/images/40143/small/cbtc.png",
  "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22":
    "https://assets.coingecko.com/coins/images/27008/small/cbeth.png",
  "0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452":
    "https://assets.coingecko.com/coins/images/18834/small/wstETH.png",
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631":
    "https://assets.coingecko.com/coins/images/31745/small/token.png",
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2":
    "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb":
    "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
  "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42":
    "https://assets.coingecko.com/coins/images/26045/small/euro.png",
  "0x532f27101965dd16442e59d40670faf5ebb142e4":
    "https://assets.coingecko.com/coins/images/35529/small/Logo.png",
  "0x4ed4e862860bed51a9570b96d89af5e1b0efefed":
    "https://assets.coingecko.com/coins/images/34515/small/android-chrome-512x512.png",
  "0x1111111111166b7fe7bd91427724b487980afc69":
    "https://assets.coingecko.com/coins/images/54683/small/zora.jpg",
};

export const ETH_LOGO_URL =
  "https://assets.coingecko.com/coins/images/279/small/ethereum.png";

export function tokenLogoUrl(address: string): string {
  const key = address.trim().toLowerCase();
  if (KNOWN_LOGO[key]) return KNOWN_LOGO[key];
  return `https://dd.dexscreener.com/ds-data/tokens/base/${key}.png`;
}

/** Secondary fallback when DexScreener has no art for a token. */
export function tokenLogoFallbackUrl(address: string): string {
  const key = address.trim().toLowerCase();
  return `https://tokens.1inch.io/${key}.png`;
}

export function enrichSwapCounter<T extends TokenLike>(counter: T): T {
  if (counter.kind === "eth") return counter;
  if (counter.imageUrl) return counter;
  return {
    ...counter,
    imageUrl: tokenLogoUrl(counter.address),
  };
}

export function commonTokenToCounter(token: {
  address: string;
  symbol: string;
  decimals: number;
}): Extract<TokenLike, { kind: "token" }> {
  return enrichSwapCounter({
    kind: "token",
    address: token.address,
    symbol: token.symbol,
    decimals: token.decimals,
  }) as Extract<TokenLike, { kind: "token" }>;
}
