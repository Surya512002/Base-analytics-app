import type { Address, Hex } from "viem";
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
  quoteUniswapMultiHop,
  applySlippage,
  SWAP_ROUTER_02,
  WETH_BASE,
  type UniswapFeeTier,
} from "@/lib/launchpad/uniswap";
import { USDC_BASE } from "@/lib/launchpad/tokens-base";

export type LaunchDex = "auto" | "uniswap" | "aerodrome" | "slipstream" | "o1";

/** Venues an executed swap can route through ("aggregator" = 0x fallback, "o1" = o1 Trading API). */
export type SwapVenue = "uniswap" | "aerodrome" | "slipstream" | "aggregator" | "o1";

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
  uniswapPath?: Hex;
  uniswapMultiHop?: boolean;
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
  quoteToken?: Address;
  /** When true, try Aerodrome WETH↔USDC↔token if direct WETH pool is empty. */
  allowUsdcHop?: boolean;
}): Promise<DexQuoteResult> {
  const quoteToken = params.quoteToken ?? (WETH_BASE as Address);
  const tokenIn = params.direction === "buy" ? quoteToken : params.token;
  const tokenOut = params.direction === "buy" ? params.token : quoteToken;

  const order: Array<Exclude<SwapVenue, "aggregator" | "o1">> =
    params.dex && params.dex !== "auto" && params.dex !== "o1"
      ? [params.dex]
      : ["slipstream", "aerodrome", "uniswap"];

  const quoteVenue = async (venue: Exclude<SwapVenue, "aggregator" | "o1">) => {
    if (venue === "uniswap") return quoteSwapExactIn(tokenIn, tokenOut, params.amountIn);
    if (venue === "aerodrome") return quoteAerodromeExactIn(tokenIn, tokenOut, params.amountIn);
    return quoteSlipstreamExactIn(tokenIn, tokenOut, params.amountIn);
  };

  const [uni, aero, slip] = await Promise.all([
    quoteSwapExactIn(tokenIn, tokenOut, params.amountIn),
    quoteAerodromeExactIn(tokenIn, tokenOut, params.amountIn),
    quoteSlipstreamExactIn(tokenIn, tokenOut, params.amountIn),
  ]);

  const routers: Record<Exclude<SwapVenue, "aggregator" | "o1">, `0x${string}`> = {
    uniswap: SWAP_ROUTER_02,
    aerodrome: AERODROME_ROUTER,
    slipstream: SLIPSTREAM_SWAP_ROUTER,
  };

  const pick = (
    dex: Exclude<SwapVenue, "aggregator" | "o1">,
    extras?: {
      aerodromeHops?: AerodromeHop[];
      uniswapPath?: Hex;
      uniswapMultiHop?: boolean;
      uniswapFeeTier?: UniswapFeeTier;
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
      uniswapHasLiquidity: uni.hasLiquidity || Boolean(extras?.uniswapMultiHop),
      aerodromeHasLiquidity: aero.hasLiquidity || Boolean(extras?.aerodromeHops?.length),
      slipstreamHasLiquidity: slip.hasLiquidity,
      uniswapFeeTier: extras?.uniswapFeeTier ?? uni.feeTier,
      uniswapPath: extras?.uniswapPath,
      uniswapMultiHop: extras?.uniswapMultiHop,
      aerodromeStable: extras?.aerodromeStable ?? aero.stable,
      aerodromeHops: extras?.aerodromeHops,
      slipstreamTickSpacing: slip.tickSpacing,
    };
  };

  const pref = params.dex ?? "auto";
  if (pref !== "auto" && pref !== "o1") {
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
    if (pref === "uniswap" && params.allowUsdcHop !== false) {
      const uniHop = await quoteUniswapMultiHop({
        tokenIn,
        intermediateToken: USDC_BASE as Address,
        tokenOut,
        amountIn: params.amountIn,
      });
      if (uniHop.hasLiquidity && uniHop.path) {
        return pick("uniswap", {
          uniswapPath: uniHop.path,
          uniswapMultiHop: true,
          uniswapFeeTier: uniHop.fee2 as UniswapFeeTier,
          amountOut: uniHop.amountOut,
          hasLiquidity: true,
        });
      }
    }
    return pick(pref);
  }

  // Auto mode: check direct pairs first
  const candidates = [
    { dex: "uniswap" as const, out: uni.hasLiquidity ? uni.amountOut : BigInt(0) },
    { dex: "aerodrome" as const, out: aero.hasLiquidity ? aero.amountOut : BigInt(0) },
    { dex: "slipstream" as const, out: slip.hasLiquidity ? slip.amountOut : BigInt(0) },
  ].filter((c) => c.out > BigInt(0));

  if (candidates.length > 0) {
    candidates.sort((a, b) => (b.out > a.out ? 1 : b.out < a.out ? -1 : 0));
    return pick(candidates[0]!.dex);
  }

  // Multi-hop routing through USDC or WETH if direct pair has no liquidity
  if (params.allowUsdcHop !== false) {
    const isUsdcMid =
      tokenIn.toLowerCase() !== USDC_BASE.toLowerCase() &&
      tokenOut.toLowerCase() !== USDC_BASE.toLowerCase();
    const isWethMid =
      tokenIn.toLowerCase() !== WETH_BASE.toLowerCase() &&
      tokenOut.toLowerCase() !== WETH_BASE.toLowerCase();

    const [aeroHop, uniUsdcHop, uniWethHop] = await Promise.all([
      quoteAerodromeUsdcHop(tokenIn, tokenOut, params.amountIn),
      isUsdcMid
        ? quoteUniswapMultiHop({
            tokenIn,
            intermediateToken: USDC_BASE as Address,
            tokenOut,
            amountIn: params.amountIn,
          })
        : Promise.resolve({
            amountOut: BigInt(0),
            hasLiquidity: false,
            path: null as Hex | null,
            fee1: 500,
            fee2: 3000,
          }),
      isWethMid
        ? quoteUniswapMultiHop({
            tokenIn,
            intermediateToken: WETH_BASE as Address,
            tokenOut,
            amountIn: params.amountIn,
          })
        : Promise.resolve({
            amountOut: BigInt(0),
            hasLiquidity: false,
            path: null as Hex | null,
            fee1: 500,
            fee2: 3000,
          }),
    ]);

    const multiCandidates: Array<{
      dex: "uniswap" | "aerodrome";
      out: bigint;
      extras: Parameters<typeof pick>[1];
    }> = [];

    if (uniUsdcHop.hasLiquidity && uniUsdcHop.path) {
      multiCandidates.push({
        dex: "uniswap",
        out: uniUsdcHop.amountOut,
        extras: {
          uniswapPath: uniUsdcHop.path,
          uniswapMultiHop: true,
          uniswapFeeTier: uniUsdcHop.fee2 as UniswapFeeTier,
          amountOut: uniUsdcHop.amountOut,
          hasLiquidity: true,
        },
      });
    }

    if (uniWethHop.hasLiquidity && uniWethHop.path) {
      multiCandidates.push({
        dex: "uniswap",
        out: uniWethHop.amountOut,
        extras: {
          uniswapPath: uniWethHop.path,
          uniswapMultiHop: true,
          uniswapFeeTier: uniWethHop.fee2 as UniswapFeeTier,
          amountOut: uniWethHop.amountOut,
          hasLiquidity: true,
        },
      });
    }

    if (aeroHop.hasLiquidity) {
      multiCandidates.push({
        dex: "aerodrome",
        out: aeroHop.amountOut,
        extras: {
          aerodromeHops: aeroHop.hops,
          amountOut: aeroHop.amountOut,
          hasLiquidity: true,
        },
      });
    }

    if (multiCandidates.length > 0) {
      multiCandidates.sort((a, b) => (b.out > a.out ? 1 : b.out < a.out ? -1 : 0));
      const best = multiCandidates[0]!;
      return pick(best.dex, best.extras);
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
  if (dex === "o1") return "o1 Trading API";
  return "Uniswap V3";
}
