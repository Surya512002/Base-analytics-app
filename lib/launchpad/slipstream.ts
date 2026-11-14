import { encodeFunctionData, getAddress, parseAbi, type Address, type Hex } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { simQuoteExactIn } from "@/lib/onchain/sim-quoter";
import { WETH_BASE } from "@/lib/launchpad/uniswap";

/** Aerodrome Slipstream (concentrated liquidity) on Base mainnet. */
export const SLIPSTREAM_SWAP_ROUTER =
  "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5" as const;

export const SLIPSTREAM_QUOTER_V2 =
  "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0" as const;

/**
 * Newer Slipstream deployment where Coinbase stock pools live (USDC/stock, tick spacing 10).
 * Verified on-chain: the AMDc/USDC pool's factory() is this address, and this router's
 * factory() returns it (thousands of real swaps go through it). Its pools aren't visible to
 * the original quoter, so they're quoted with SimQuoter instead.
 */
export const SLIPSTREAM_V2_FACTORY = getAddress("0x9cb220581b91b0c83223012fe69688b92ad07a76");
export const SLIPSTREAM_V2_ROUTER = getAddress("0x9ee35bf1bd69a03c6f0393582030fce8bb93d418");
const SLIPSTREAM_V2_TICK_SPACINGS = [10, 1, 50, 100, 200, 2000] as const;
const FACTORY_ABI = parseAbi(["function getPool(address tokenA, address tokenB, int24 tickSpacing) view returns (address)"]);
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/** Best pool on the newer factory for a pair, quoted exactly via SimQuoter. */
export async function quoteSlipstreamV2ExactIn(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<{ amountOut: bigint; tickSpacing: number; pool: Address | null }> {
  const none = { amountOut: BigInt(0), tickSpacing: 10, pool: null };
  if (amountIn <= BigInt(0)) return none;
  const pub = createBasePublicClient();
  const zeroForOne = tokenIn.toLowerCase() < tokenOut.toLowerCase();
  const results = await Promise.all(
    SLIPSTREAM_V2_TICK_SPACINGS.map(async (tickSpacing) => {
      try {
        const pool = (await pub.readContract({
          address: SLIPSTREAM_V2_FACTORY,
          abi: FACTORY_ABI,
          functionName: "getPool",
          args: [tokenIn, tokenOut, tickSpacing],
        })) as Address;
        if (!pool || pool === ZERO_ADDR) return none;
        const amountOut = await simQuoteExactIn(pub, pool, zeroForOne, amountIn);
        return { amountOut, tickSpacing, pool };
      } catch {
        return none;
      }
    })
  );
  return results.reduce((best, r) => (r.amountOut > best.amountOut ? r : best), none);
}

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
 * Slipstream forks v3-periphery's SwapRouter, where `address(0)` — not
 * SwapRouter02's `address(2)` — is the "keep funds in the router" sentinel.
 */
const ROUTER_ADDRESS_THIS =
  "0x0000000000000000000000000000000000000000" as const;

function swapDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
}

/**
 * Quote one specific tick spacing.
 *
 * Exported so price-impact probes can re-quote the already-chosen pool with a
 * single `eth_call` instead of scanning every spacing again.
 */
export async function quoteSlipstreamTickSpacing(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  tickSpacing: number
): Promise<bigint> {
  const original = await quoteSlipstreamOriginal(tokenIn, tokenOut, amountIn, tickSpacing);
  if (original > BigInt(0)) return original;
  // Same spacing on the newer stock-pool deployment (price-impact probes re-quote the chosen pool).
  try {
    const pub = createBasePublicClient();
    const pool = (await pub.readContract({
      address: SLIPSTREAM_V2_FACTORY,
      abi: FACTORY_ABI,
      functionName: "getPool",
      args: [tokenIn, tokenOut, tickSpacing],
    })) as Address;
    if (!pool || pool === ZERO_ADDR) return BigInt(0);
    return await simQuoteExactIn(pub, pool, tokenIn.toLowerCase() < tokenOut.toLowerCase(), amountIn);
  } catch {
    return BigInt(0);
  }
}

async function quoteSlipstreamOriginal(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  tickSpacing: number
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
  tickSpacing: number;
  /** Router for the winning pool (original deployment or the newer stock-pool one). */
  router: Address;
}> {
  if (amountIn <= BigInt(0)) {
    return { amountOut: BigInt(0), hasLiquidity: false, tickSpacing: 200, router: SLIPSTREAM_SWAP_ROUTER };
  }
  const v2Promise = quoteSlipstreamV2ExactIn(tokenIn, tokenOut, amountIn);

  const quotes = await Promise.all(
    SLIPSTREAM_TICK_SPACINGS.map(async (tickSpacing) => ({
      tickSpacing,
      amountOut: await quoteSlipstreamOriginal(
        tokenIn,
        tokenOut,
        amountIn,
        tickSpacing
      ),
    }))
  );

  let best = quotes[0]!;
  for (const q of quotes) {
    if (q.amountOut > best.amountOut) best = q;
  }

  const v2 = await v2Promise;
  if (v2.amountOut > best.amountOut) {
    return { amountOut: v2.amountOut, hasLiquidity: true, tickSpacing: v2.tickSpacing, router: SLIPSTREAM_V2_ROUTER };
  }
  return {
    amountOut: best.amountOut,
    hasLiquidity: best.amountOut > BigInt(0),
    tickSpacing: best.tickSpacing,
    router: SLIPSTREAM_SWAP_ROUTER,
  };
}

/** Token → token exact-input swap (e.g. USDC ↔ stock). Works with both Slipstream routers. */
export function encodeSlipstreamExactInput(params: {
  tokenIn: Address;
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
        tokenIn: params.tokenIn,
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

/**
 * Sell: token → native ETH.
 *
 * The pool can only pay out WETH, so the swap credits the router and a batched
 * `unwrapWETH9` forwards real ETH to the recipient in the same transaction.
 */
export function encodeSlipstreamSell(params: {
  tokenIn: Address;
  recipient: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
  tickSpacing: number;
}): Hex {
  const swap = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: params.tokenIn,
        tokenOut: WETH_BASE as Address,
        tickSpacing: params.tickSpacing,
        recipient: ROUTER_ADDRESS_THIS,
        deadline: swapDeadline(),
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
