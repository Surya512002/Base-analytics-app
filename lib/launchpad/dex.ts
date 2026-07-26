import type { Address } from "viem";
import {
  quoteAerodromeExactIn,
  quoteAerodromeUsdcHop,
  AERODROME_ROUTER,
  type AerodromeHop,
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
  aerodromeHops?: AerodromeHop[];
  slipstreamTickSpacing?: SlipstreamTickSpacing;
};

export async function quoteLaunchSwap(params: {
  token: Address;
  direction: "buy" | "sell";
  amountIn: bigint;
  slippageBps: number;
  dex?: LaunchDex;
  /** When true, try Aerodrome WETH↔USDC↔token if direct WETH pool is empty. */
  allowUsdcHop?: boolean;
}): Promise<DexQuoteResult> {
  const weth = WETH_BASE as Address;
  const tokenIn = params.direction === "buy" ? weth : params.token;
  const tokenOut = params.direction === "buy" ? params.token : weth;

  const order: Array<Exclude<SwapVenue, "aggregator">> =
    params.dex && params.dex !== "auto"
      ? [params.dex]
      : ["slipstream", "aerodrome", "uniswap"];

  const quoteVenue = async (venue: Exclude<SwapVenue, "aggregator">) => {
    if (venue === "uniswap") return quoteSwapExactIn(tokenIn, tokenOut, params.amountIn);
    if (venue === "aerodrome") return quoteAerodromeExactIn(tokenIn, tokenOut, params.amountIn);
    return quoteSlipstreamExactIn(tokenIn, tokenOut, params.amountIn);
  };

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

  const pick = (
    dex: Exclude<SwapVenue, "aggregator">,
    extras?: {
      aerodromeHops?: AerodromeHop[];
      amountOut?: bigint;
      hasLiquidity?: boolean;
      aerodromeStable?: boolean;
    }
  ) => {
    const q = dex === "uniswap" ? uni : dex === "aerodrome" ? aero : slip;
    const amountOut = extras?.amountOut ?? q.amountOut;
    const hasLiquidity = extras?.hasLiquidity ?? q.hasLiquidity;
    return {
      dex,
      amountOut,
      amountOutMinimum: applySlippage(amountOut, params.slippageBps),
      hasLiquidity,
      router: routers[dex],
      uniswapHasLiquidity: uni.hasLiquidity,
      aerodromeHasLiquidity: aero.hasLiquidity || Boolean(extras?.aerodromeHops?.length),
      slipstreamHasLiquidity: slip.hasLiquidity,
      uniswapFeeTier: uni.feeTier,
      aerodromeStable: extras?.aerodromeStable ?? aero.stable,
      aerodromeHops: extras?.aerodromeHops,
      slipstreamTickSpacing: slip.tickSpacing,
    };
  };

  const pref = params.dex ?? "auto";
  if (pref !== "auto") {
    const q = await quoteVenue(pref);
    if (q.hasLiquidity) return pick(pref);
    if (pref === "aerodrome" && params.allowUsdcHop !== false) {
      const hop = await quoteAerodromeUsdcHop(tokenIn, tokenOut, params.amountIn);
      if (hop.hasLiquidity) {
        return pick("aerodrome", {
          aerodromeHops: hop.hops,
          amountOut: hop.amountOut,
          hasLiquidity: true,
        });
      }
    }
    return pick(pref);
  }

  const candidates = [
    { dex: "uniswap" as const, out: uni.hasLiquidity ? uni.amountOut : BigInt(0) },
    { dex: "aerodrome" as const, out: aero.hasLiquidity ? aero.amountOut : BigInt(0) },
    { dex: "slipstream" as const, out: slip.hasLiquidity ? slip.amountOut : BigInt(0) },
  ].filter((c) => c.out > BigInt(0));

  if (candidates.length > 0) {
    candidates.sort((a, b) => (b.out > a.out ? 1 : b.out < a.out ? -1 : 0));
    return pick(candidates[0]!.dex);
  }

  if (params.allowUsdcHop !== false) {
    const hop = await quoteAerodromeUsdcHop(tokenIn, tokenOut, params.amountIn);
    if (hop.hasLiquidity) {
      return pick("aerodrome", {
        aerodromeHops: hop.hops,
        amountOut: hop.amountOut,
        hasLiquidity: true,
      });
    }
  }

  return {
    dex: order[0] ?? "uniswap",
    amountOut: BigInt(0),
    amountOutMinimum: BigInt(0),
    hasLiquidity: false,
    router: routers[order[0] ?? "uniswap"],
    uniswapHasLiquidity: uni.hasLiquidity,
    aerodromeHasLiquidity: aero.hasLiquidity,
    slipstreamHasLiquidity: slip.hasLiquidity,
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
