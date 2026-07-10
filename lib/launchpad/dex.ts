import type { Address } from "viem";
import {
  quoteAerodromeExactIn,
  AERODROME_ROUTER,
} from "@/lib/launchpad/aerodrome";
import {
  quoteSwapExactIn,
  applySlippage,
  SWAP_ROUTER_02,
  WETH_BASE,
  type UniswapFeeTier,
} from "@/lib/launchpad/uniswap";

export type LaunchDex = "auto" | "uniswap" | "aerodrome";

export type DexQuoteResult = {
  dex: "uniswap" | "aerodrome";
  amountOut: bigint;
  amountOutMinimum: bigint;
  hasLiquidity: boolean;
  router: `0x${string}`;
  uniswapHasLiquidity: boolean;
  aerodromeHasLiquidity: boolean;
  uniswapFeeTier?: UniswapFeeTier;
  aerodromeStable?: boolean;
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

  const [uni, aero] = await Promise.all([
    quoteSwapExactIn(tokenIn, tokenOut, params.amountIn),
    quoteAerodromeExactIn(tokenIn, tokenOut, params.amountIn),
  ]);

  const pick = (dex: "uniswap" | "aerodrome") => {
    const q = dex === "uniswap" ? uni : aero;
    return {
      dex,
      amountOut: q.amountOut,
      amountOutMinimum: applySlippage(q.amountOut, params.slippageBps),
      hasLiquidity: q.hasLiquidity,
      router: (dex === "uniswap" ? SWAP_ROUTER_02 : AERODROME_ROUTER) as `0x${string}`,
      uniswapHasLiquidity: uni.hasLiquidity,
      aerodromeHasLiquidity: aero.hasLiquidity,
      uniswapFeeTier: uni.feeTier,
      aerodromeStable: aero.stable,
    };
  };

  const pref = params.dex ?? "auto";
  if (pref === "uniswap") return pick("uniswap");
  if (pref === "aerodrome") return pick("aerodrome");

  if (uni.hasLiquidity && !aero.hasLiquidity) return pick("uniswap");
  if (aero.hasLiquidity && !uni.hasLiquidity) return pick("aerodrome");
  if (uni.hasLiquidity && aero.hasLiquidity) {
    return aero.amountOut > uni.amountOut ? pick("aerodrome") : pick("uniswap");
  }

  return {
    dex: "uniswap",
    amountOut: BigInt(0),
    amountOutMinimum: BigInt(0),
    hasLiquidity: false,
    router: SWAP_ROUTER_02,
    uniswapHasLiquidity: false,
    aerodromeHasLiquidity: false,
  };
}

export function aerodromeDepositUrl(token: string): string {
  const weth = WETH_BASE.toLowerCase();
  const t = token.toLowerCase();
  return `https://aerodrome.finance/deposit?token0=${weth}&token1=${t}&chain=8453`;
}

export function uniswapPoolUrl(token: string): string {
  return `https://app.uniswap.org/explore/pools/base?search=${token}`;
}

export function dexLabel(dex: "uniswap" | "aerodrome"): string {
  return dex === "aerodrome" ? "Aerodrome" : "Uniswap V3";
}
