import { encodeFunctionData, type Address, type Hex } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { WETH_BASE } from "@/lib/launchpad/uniswap";

/** Aerodrome Slipstream (concentrated liquidity) on Base mainnet. */
export const SLIPSTREAM_SWAP_ROUTER =
  "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5" as const;

export const SLIPSTREAM_QUOTER_V2 =
  "0x254cF9E1E6e233aa1AC962CB9B05b2cFeAAe15b0" as const;

/** Tick spacings Aerodrome deploys Slipstream pools with. */
export const SLIPSTREAM_TICK_SPACINGS = [1, 50, 100, 200, 2000] as const;
export type SlipstreamTickSpacing = (typeof SLIPSTREAM_TICK_SPACINGS)[number];

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
          { name: "tickSpacing", type: "int24" },
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
          { name: "tickSpacing", type: "int24" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

function swapDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
}

async function quoteTickSpacing(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  tickSpacing: SlipstreamTickSpacing
): Promise<bigint> {
  try {
    const pub = createBasePublicClient();
    const result = await pub.simulateContract({
      address: SLIPSTREAM_QUOTER_V2,
      abi: QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn,
          tokenOut,
          amountIn,
          tickSpacing,
          sqrtPriceLimitX96: BigInt(0),
        },
      ],
    });
    return result.result[0];
  } catch {
    return BigInt(0);
  }
}

export async function quoteSlipstreamExactIn(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<{
  amountOut: bigint;
  hasLiquidity: boolean;
  tickSpacing: SlipstreamTickSpacing;
}> {
  if (amountIn <= BigInt(0)) {
    return { amountOut: BigInt(0), hasLiquidity: false, tickSpacing: 200 };
  }

  const quotes = await Promise.all(
    SLIPSTREAM_TICK_SPACINGS.map(async (tickSpacing) => ({
      tickSpacing,
      amountOut: await quoteTickSpacing(tokenIn, tokenOut, amountIn, tickSpacing),
    }))
  );

  let best = quotes[0]!;
  for (const q of quotes) {
    if (q.amountOut > best.amountOut) best = q;
  }

  return {
    amountOut: best.amountOut,
    hasLiquidity: best.amountOut > BigInt(0),
    tickSpacing: best.tickSpacing,
  };
}

/** Buy: WETH → token (send `amountIn` as tx value; router wraps ETH). */
export function encodeSlipstreamBuy(params: {
  tokenOut: Address;
  recipient: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
  tickSpacing: number;
}): Hex {
  return encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: WETH_BASE as Address,
        tokenOut: params.tokenOut,
        tickSpacing: params.tickSpacing,
        recipient: params.recipient,
        deadline: swapDeadline(),
        amountIn: params.amountIn,
        amountOutMinimum: params.amountOutMinimum,
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
  });
}

/** Sell: token → WETH (recipient receives WETH, same as the Uniswap V3 path). */
export function encodeSlipstreamSell(params: {
  tokenIn: Address;
  recipient: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
  tickSpacing: number;
}): Hex {
  return encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: params.tokenIn,
        tokenOut: WETH_BASE as Address,
        tickSpacing: params.tickSpacing,
        recipient: params.recipient,
        deadline: swapDeadline(),
        amountIn: params.amountIn,
        amountOutMinimum: params.amountOutMinimum,
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
  });
}
