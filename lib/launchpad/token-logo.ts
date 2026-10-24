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

export const SELF_HOSTED_LOGOS = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x0578d8a44db98b23bf096a382e016e29a5ce0ffe",
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b",
  "0x1111111111166b7fe7bd91427724b487980afc69",
  "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22",
  "0x4200000000000000000000000000000000000006",
  "0x4ed4e862860bed51a9570b96d89af5e1b0efefed",
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",
  "0x532f27101965dd16442e59d40670faf5ebb142e4",
  "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42",
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
  "0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4",
  "0xb2000000000000000000000d8ce462e99ee7a47b",
  "0xb20000000000000000000018fe7ec7d6dfeeb528",
  "0xb20000000000000000000019f6e7c675b73c2e4d",
  "0xb2000000000000000000001e800a7f5189430cd0",
  "0xb20000000000000000000024170488e788cbbcb4",
  "0xb20000000000000000000026215d755356e5043f",
  "0xb2000000000000000000002d0ba3164cc74f58b7",
  "0xb200000000000000000000397293cb8cda9a10c5",
  "0xb2000000000000000000003e4249c65bd6c037d9",
  "0xb2000000000000000000003ef37a7c863dc1482a",
  "0xb200000000000000000000450ad3abe5d4846c6e",
  "0xb2000000000000000000004884b426556b92883d",
  "0xb2000000000000000000004aff16039ba04bdfbc",
  "0xb20000000000000000000058b8c947e44011dfe6",
  "0xb20000000000000000000066242d4067724cb7a1",
  "0xb2000000000000000000007790ed6e48e06ed935",
  "0xb20000000000000000000078ee7ce2fe4908108c",
  "0xb2000000000000000000007b9fcbd005511acbd5",
  "0xb2000000000000000000007d16372840df4dabbe",
  "0xb2000000000000000000008a7508619c717a7106",
  "0xb2000000000000000000008bc8786b856e61707c",
  "0xb200000000000000000000a310e034e09186fb2d",
  "0xb200000000000000000000ab99cfa739e253872b",
  "0xb200000000000000000000bd0c7627b663c581a6",
  "0xb200000000000000000000c2e324d24d7eecd1fb",
  "0xb200000000000000000000c85a31389d71f3ecfb",
  "0xb200000000000000000000cae20cb1446462e24c",
  "0xb200000000000000000000cd7e6b8042cb7c2bb5",
  "0xb200000000000000000000d9192b6b456483c2e8",
  "0xb200000000000000000000e8e50cbbb9a3861a3c",
  "0xb200000000000000000000f1a0f91e34892e4718",
  "0xb200000000000000000000fc737aea6196ab5a4c",
  "0xbaa5cc21fd487b8fcc2f632f3f4e8d37262a0842",
  "0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452",
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
  "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca",
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
]);

export const ETH_LOGO_URL = "/tokens/0x0000000000000000000000000000000000000000.png";

export function tokenLogoUrl(address: string, symbol?: string): string {
  const key = address.trim().toLowerCase();
  if (key === "eth" || key === "0x0000000000000000000000000000000000000000") {
    return ETH_LOGO_URL;
  }
  if (SELF_HOSTED_LOGOS.has(key) || key.startsWith("0xb200000000000000000000")) {
    return `/tokens/${key}.png`;
  }
  if (KNOWN_LOGO[key]) return KNOWN_LOGO[key];
  return `/api/token-logo/${key}${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ""}`;
}

/** Secondary fallback when primary logo needs local fallback. */
export function tokenLogoFallbackUrl(address: string): string {
  const key = address.trim().toLowerCase();
  return `/tokens/${key}.png`;
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
