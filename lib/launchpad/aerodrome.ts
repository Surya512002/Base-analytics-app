import {
  encodeFunctionData,
  type Address,
  type Hex,
} from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { WETH_BASE } from "@/lib/launchpad/uniswap";

export const AERODROME_ROUTER =
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43" as const;

/** Aerodrome Slipstream PoolFactory on Base */
export const AERODROME_FACTORY =
  "0x420DD381b31aEf6683db6B902084cB0FFECe40Da" as const;

const ROUTER_ABI = [
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
          { name: "factory", type: "address" },
        ],
      },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactETHForTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
          { name: "factory", type: "address" },
        ],
      },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForETH",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      {
        name: "routes",
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "stable", type: "bool" },
          { name: "factory", type: "address" },
        ],
      },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

type Route = {
  from: Address;
  to: Address;
  stable: boolean;
  factory: Address;
};

function buildRoute(tokenIn: Address, tokenOut: Address, stable: boolean): Route[] {
  return [
    {
      from: tokenIn,
      to: tokenOut,
      stable,
      factory: AERODROME_FACTORY,
    },
  ];
}

function swapDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
}

/**
 * Quote one specific pool type.
 *
 * Exported so price-impact probes can re-quote the already-chosen pool without
 * paying for both the volatile and stable lookups again.
 */
export async function quoteAerodromeRoute(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  stable: boolean
): Promise<{ amountOut: bigint; hasLiquidity: boolean; stable: boolean }> {
  try {
    const pub = createBasePublicClient();
    const amounts = await pub.readContract({
      address: AERODROME_ROUTER,
      abi: ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [amountIn, buildRoute(tokenIn, tokenOut, stable)],
    });
    const amountOut = amounts[amounts.length - 1] ?? BigInt(0);
    return { amountOut, hasLiquidity: amountOut > BigInt(0), stable };
  } catch {
    return { amountOut: BigInt(0), hasLiquidity: false, stable };
  }
}

export async function quoteAerodromeExactIn(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<{ amountOut: bigint; hasLiquidity: boolean; stable: boolean }> {
  if (amountIn <= BigInt(0)) {
    return { amountOut: BigInt(0), hasLiquidity: false, stable: false };
  }

  const [volatile, stablePool] = await Promise.all([
    quoteAerodromeRoute(tokenIn, tokenOut, amountIn, false),
    quoteAerodromeRoute(tokenIn, tokenOut, amountIn, true),
  ]);

  if (stablePool.amountOut > volatile.amountOut) return stablePool;
  return volatile;
}

export function encodeAerodromeBuy(params: {
  tokenOut: Address;
  recipient: Address;
  amountOutMinimum: bigint;
  stable?: boolean;
}): Hex {
  const stable = params.stable ?? false;
  return encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: "swapExactETHForTokens",
    args: [
      params.amountOutMinimum,
      buildRoute(WETH_BASE as Address, params.tokenOut, stable),
      params.recipient,
      swapDeadline(),
    ],
  });
}

export function encodeAerodromeSell(params: {
  tokenIn: Address;
  recipient: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
  stable?: boolean;
}): Hex {
  const stable = params.stable ?? false;
  return encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: "swapExactTokensForETH",
    args: [
      params.amountIn,
      params.amountOutMinimum,
      buildRoute(params.tokenIn, WETH_BASE as Address, stable),
      params.recipient,
      swapDeadline(),
    ],
  });
}

export { ROUTER_ABI };
