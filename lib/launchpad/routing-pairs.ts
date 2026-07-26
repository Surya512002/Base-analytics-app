import { WETH_BASE } from "@/lib/launchpad/uniswap";
import { USDC_BASE } from "@/lib/launchpad/tokens-base";
import type { DexScreenerPair } from "@/lib/launchpad/dexscreener";
import type { LaunchDex } from "@/lib/launchpad/dex";

const WETH = WETH_BASE.toLowerCase();
const USDC = USDC_BASE.toLowerCase();

export type RoutingPairInfo = {
  pair: DexScreenerPair;
  counter: `0x${string}`;
  counterKind: "weth" | "usdc" | "other";
  dexId: string | null;
};

/** Prefer WETH, then USDC, then deepest pool — matches how we actually swap. */
export function pickRoutingPair(
  pairs: DexScreenerPair[],
  tokenAddress: string
): RoutingPairInfo | null {
  const token = tokenAddress.toLowerCase();
  const basePairs = pairs.filter((p) => (p.chainId ?? "base").toLowerCase() === "base");

  const parsed: RoutingPairInfo[] = [];
  for (const pair of basePairs) {
    const base = pair.baseToken?.address?.toLowerCase();
    const quote = pair.quoteToken?.address?.toLowerCase();
    if (!base || !quote) continue;

    let counter: string | null = null;
    if (base === token && quote !== token) counter = quote;
    else if (quote === token && base !== token) counter = base;
    if (!counter || !/^0x[a-f0-9]{40}$/.test(counter)) continue;

    const counterKind =
      counter === WETH ? "weth" : counter === USDC ? "usdc" : "other";
    parsed.push({
      pair,
      counter: counter as `0x${string}`,
      counterKind,
      dexId: pair.dexId ?? null,
    });
  }

  if (!parsed.length) return null;

  const rank = (p: RoutingPairInfo) => {
    const kindScore = p.counterKind === "weth" ? 3 : p.counterKind === "usdc" ? 2 : 1;
    const liq = p.pair.liquidity?.usd ?? 0;
    return kindScore * 1e12 + liq;
  };

  parsed.sort((a, b) => rank(b) - rank(a));
  return parsed[0] ?? null;
}

/** Map DexScreener dex id → in-app venue to try first. */
export function inferPreferredDex(dexId: string | null | undefined): LaunchDex | null {
  const id = (dexId ?? "").toLowerCase();
  if (!id) return null;
  if (id.includes("slipstream")) return "slipstream";
  if (id.includes("aerodrome")) return "aerodrome";
  if (id.includes("uniswap")) return "uniswap";
  return null;
}
