import {
  createPublicClient,
  encodeFunctionData,
  http,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { getBaseRpcUrls } from "@/lib/utils/base-rpc";

export const WETH_BASE =
  "0x4200000000000000000000000000000000000006" as const;

export const SWAP_ROUTER_02 =
  "0x2626664c2603336E57B97c5bfad9bb53f0f42e74" as const;

export const QUOTER_V2 =
  "0x3d4e44EbC4aD5650a2715f8292cd71C024322B1e" as const;

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
] as const;

function getClient() {
  return createPublicClient({
    chain: base,
    transport: http(getBaseRpcUrls()[0]),
  });
}

async function quoteFeeTier(
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
      amountOut: await quoteFeeTier(tokenIn, tokenOut, amountIn, fee),
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
