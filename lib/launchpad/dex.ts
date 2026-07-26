import type { Address } from "viem";
import {
  quoteAerodromeExactIn,
  AERODROME_ROUTER,
} from "@/lib/launchpad/aerodrome";
import {
  quoteSlipstreamExactIn,
  SLIPSTREAM_SWAP_ROUTER,
  type SlipstreamTickSpacing,
} from "@/lib/launchpad/slipstream";
import {
  quoteSwapExactIn,
  applySlippage,
  SWAP_ROUTER_02,
  WETH_BASE,
  type UniswapFeeTier,
} from "@/lib/launchpad/uniswap";

export type LaunchDex = "auto" | "uniswap" | "aerodrome" | "slipstream";

/** Venues an executed swap can route through ("aggregator" = 0x fallback). */
export type SwapVenue = "uniswap" | "aerodrome" | "slipstream" | "aggregator";

export type DexQuoteResult = {
  dex: SwapVenue;
  amountOut: bigint;
  amountOutMinimum: bigint;
  hasLiquidity: boolean;
  router: `0x${string}`;
  uniswapHasLiquidity: boolean;
  aerodromeHasLiquidity: boolean;
  slipstreamHasLiquidity: boolean;
  uniswapFeeTier?: UniswapFeeTier;
  aerodromeStable?: boolean;
  slipstreamTickSpacing?: SlipstreamTickSpacing;
};

export async function quoteLaunchSwap(params: {
  token: Address;
  direction: "buy" | "sell";
  amountIn: bigint;
  slippageBps: number;
  dex?: LaunchDex;
}): Promise<DexQuoteResult> {
  const weth = WETH_BASE as Address;
  const tokenIn = params.direction === "buy" ? weth : params.token;
  const tokenOut = params.direction === "buy" ? params.token : weth;

  const [uni, aero, slip] = await Promise.all([
    quoteSwapExactIn(tokenIn, tokenOut, params.amountIn),
    quoteAerodromeExactIn(tokenIn, tokenOut, params.amountIn),
    quoteSlipstreamExactIn(tokenIn, tokenOut, params.amountIn),
  ]);

  const routers: Record<Exclude<SwapVenue, "aggregator">, `0x${string}`> = {
    uniswap: SWAP_ROUTER_02,
    aerodrome: AERODROME_ROUTER,
    slipstream: SLIPSTREAM_SWAP_ROUTER,
  };

  const pick = (dex: Exclude<SwapVenue, "aggregator">) => {
    const q = dex === "uniswap" ? uni : dex === "aerodrome" ? aero : slip;
    return {
      dex,
      amountOut: q.amountOut,
      amountOutMinimum: applySlippage(q.amountOut, params.slippageBps),
      hasLiquidity: q.hasLiquidity,
      router: routers[dex],
      uniswapHasLiquidity: uni.hasLiquidity,
      aerodromeHasLiquidity: aero.hasLiquidity,
      slipstreamHasLiquidity: slip.hasLiquidity,
      uniswapFeeTier: uni.feeTier,
      aerodromeStable: aero.stable,
      slipstreamTickSpacing: slip.tickSpacing,
    };
  };

  const pref = params.dex ?? "auto";
  if (pref === "uniswap") return pick("uniswap");
  if (pref === "aerodrome") return pick("aerodrome");
  if (pref === "slipstream") return pick("slipstream");

  const candidates = [
    { dex: "uniswap" as const, out: uni.hasLiquidity ? uni.amountOut : BigInt(0) },
    { dex: "aerodrome" as const, out: aero.hasLiquidity ? aero.amountOut : BigInt(0) },
    { dex: "slipstream" as const, out: slip.hasLiquidity ? slip.amountOut : BigInt(0) },
  ].filter((c) => c.out > BigInt(0));

  if (candidates.length > 0) {
    candidates.sort((a, b) => (b.out > a.out ? 1 : b.out < a.out ? -1 : 0));
    return pick(candidates[0]!.dex);
  }

  return {
    dex: "uniswap",
    amountOut: BigInt(0),
    amountOutMinimum: BigInt(0),
    hasLiquidity: false,
    router: SWAP_ROUTER_02,
    uniswapHasLiquidity: false,
    aerodromeHasLiquidity: false,
    slipstreamHasLiquidity: false,
  };
}

export function aerodromeDepositUrl(token: string): string {
  const weth = WETH_BASE.toLowerCase();
  const t = token.toLowerCase();
  return `https://aerodrome.finance/deposit?token0=${weth}&token1=${t}&chain=8453`;
}

export function aerodromeSwapUrl(token: string): string {
  return `https://aerodrome.finance/swap?from=eth&to=${token.toLowerCase()}`;
}

export function dexscreenerTokenUrl(token: string): string {
  return `https://dexscreener.com/base/${token.toLowerCase()}`;
}

export function uniswapPoolUrl(token: string): string {
  return `https://app.uniswap.org/explore/pools/base?search=${token}`;
}

export function dexLabel(dex: SwapVenue): string {
  if (dex === "aerodrome") return "Aerodrome";
  if (dex === "slipstream") return "Slipstream";
  if (dex === "aggregator") return "0x Aggregator";
  return "Uniswap V3";
}
