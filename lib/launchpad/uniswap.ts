import {
  encodeFunctionData,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

export const WETH_BASE =
  "0x4200000000000000000000000000000000000006" as const;

export const SWAP_ROUTER_02 =
  "0x2626664c2603336E57B271c5C0b26F421741e481" as const;

export const QUOTER_V2 =
  "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a" as const;

/**
 * SwapRouter02 recipient sentinel meaning "the router itself"
 * (`Constants.ADDRESS_THIS`). Required to hold WETH mid-multicall so it can be
 * unwrapped to native ETH in the same transaction.
 */
const ROUTER_ADDRESS_THIS =
  "0x0000000000000000000000000000000000000002" as const;

/** Common Uniswap V3 fee tiers on Base */
export const UNISWAP_FEE_TIERS = [500, 3000, 10000] as const;
export type UniswapFeeTier = (typeof UNISWAP_FEE_TIERS)[number];

const QUOTER_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

const SWAP_ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "unwrapWETH9",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountMinimum", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "multicall",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
] as const;

/**
 * Uses the shared fallback transport rather than a single RPC: quote failures
 * are swallowed and surface to the user as "no route", so one rate-limited
 * endpoint would silently hide every Uniswap pool.
 */
function getClient() {
  return createBasePublicClient();
}

/**
 * Quote one specific fee tier.
 *
 * Exported so callers that already know the winning tier (price-impact probes)
 * can spend a single `eth_call` instead of re-scanning all three.
 */
export async function quoteUniswapFeeTier(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fee: UniswapFeeTier
): Promise<bigint> {
  try {
    const pub = getClient();
    const result = await pub.simulateContract({
      address: QUOTER_V2,
      abi: QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn,
          tokenOut,
          amountIn,
          fee,
          sqrtPriceLimitX96: BigInt(0),
        },
      ],
    });
    return result.result[0];
  } catch {
    return BigInt(0);
  }
}

export async function quoteSwapExactIn(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<{ amountOut: bigint; hasLiquidity: boolean; feeTier: UniswapFeeTier }> {
  let bestOut = BigInt(0);
  let bestFee: UniswapFeeTier = 3000;

  const quotes = await Promise.all(
    UNISWAP_FEE_TIERS.map(async (fee) => ({
      fee,
      amountOut: await quoteUniswapFeeTier(tokenIn, tokenOut, amountIn, fee),
    }))
  );

  for (const q of quotes) {
    if (q.amountOut > bestOut) {
      bestOut = q.amountOut;
      bestFee = q.fee;
    }
  }

  return {
    amountOut: bestOut,
    hasLiquidity: bestOut > BigInt(0),
    feeTier: bestFee,
  };
}

export function encodeExactInputSingle(params: {
  tokenIn: Address;
  tokenOut: Address;
  recipient: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
  fee?: number;
}): Hex {
  return encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        fee: params.fee ?? 3000,
        recipient: params.recipient,
        amountIn: params.amountIn,
        amountOutMinimum: params.amountOutMinimum,
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
  });
}

/**
 * Sell `tokenIn` for native ETH in one transaction.
 *
 * `exactInputSingle` can only ever pay out WETH, so the swap sends its output
 * to the router and a batched `unwrapWETH9` withdraws it and forwards real ETH
 * to the recipient. Without this the seller silently receives WETH.
 */
export function encodeExactInputSingleToEth(params: {
  tokenIn: Address;
  recipient: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
  fee?: number;
}): Hex {
  const swap = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: params.tokenIn,
        tokenOut: WETH_BASE,
        fee: params.fee ?? 3000,
        recipient: ROUTER_ADDRESS_THIS,
        amountIn: params.amountIn,
        amountOutMinimum: params.amountOutMinimum,
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
  });
  const unwrap = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "unwrapWETH9",
    args: [params.amountOutMinimum, params.recipient],
  });
  return encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "multicall",
    args: [[swap, unwrap]],
  });
}

const WETH_ABI = [
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "wad", type: "uint256" }],
    outputs: [],
  },
] as const;

/** Burn WETH for native ETH 1:1. */
export function encodeWethWithdrawCalldata(amount: bigint): Hex {
  return encodeFunctionData({
    abi: WETH_ABI,
    functionName: "withdraw",
    args: [amount],
  });
}

export function parseEthAmount(amount: string): bigint {
  const n = parseFloat(amount);
  if (!Number.isFinite(n) || n <= 0) return BigInt(0);
  return parseEther(amount);
}

export function applySlippage(amount: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.min(5000, Math.max(1, slippageBps)));
  return (amount * (BigInt(10000) - bps)) / BigInt(10000);
}

export { SWAP_ROUTER_ABI };
