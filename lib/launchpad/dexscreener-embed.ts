export function dexScreenerEmbedUrl(pairAddress: string): string {
  const pair = pairAddress.trim().toLowerCase();
  return `https://dexscreener.com/base/${pair}?embed=1&theme=dark&info=0&trades=0&chartLeftToolbar=0&chartTheme=dark&chartType=usd&interval=15`;
}

export function dexScreenerPageUrl(tokenOrPair: string): string {
  return `https://dexscreener.com/base/${tokenOrPair.trim().toLowerCase()}`;
}
