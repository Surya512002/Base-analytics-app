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

export type AerodromeHop = {
  from: Address;
  to: Address;
  stable: boolean;
};

function buildMultiRoute(hops: AerodromeHop[]): Route[] {
  return hops.map((h) => ({
    from: h.from,
    to: h.to,
    stable: h.stable,
    factory: AERODROME_FACTORY,
  }));
}

async function quoteAerodromePath(
  amountIn: bigint,
  hops: AerodromeHop[]
): Promise<{ amountOut: bigint; hasLiquidity: boolean; hops: AerodromeHop[] }> {
  if (amountIn <= BigInt(0) || hops.length === 0) {
    return { amountOut: BigInt(0), hasLiquidity: false, hops };
  }
  try {
    const pub = createBasePublicClient();
    const amounts = await pub.readContract({
      address: AERODROME_ROUTER,
      abi: ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [amountIn, buildMultiRoute(hops)],
    });
    const amountOut = amounts[amounts.length - 1] ?? BigInt(0);
    return { amountOut, hasLiquidity: amountOut > BigInt(0), hops };
  } catch {
    return { amountOut: BigInt(0), hasLiquidity: false, hops };
  }
}

/** WETH ↔ USDC ↔ token when no direct WETH pool exists on Aerodrome. */
export async function quoteAerodromeUsdcHop(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<{ amountOut: bigint; hasLiquidity: boolean; hops: AerodromeHop[] }> {
  const weth = WETH_BASE as Address;
  const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;

  let candidates: AerodromeHop[][] = [];
  if (tokenIn === weth) {
    for (const s1 of [true, false] as const) {
      for (const s2 of [true, false] as const) {
        candidates.push([
          { from: weth, to: usdc, stable: s1 },
          { from: usdc, to: tokenOut, stable: s2 },
        ]);
      }
    }
  } else if (tokenOut === weth) {
    for (const s1 of [true, false] as const) {
      for (const s2 of [true, false] as const) {
        candidates.push([
          { from: tokenIn, to: usdc, stable: s1 },
          { from: usdc, to: weth, stable: s2 },
        ]);
      }
    }
  } else {
    return { amountOut: BigInt(0), hasLiquidity: false, hops: [] };
  }

  let best = { amountOut: BigInt(0), hasLiquidity: false, hops: [] as AerodromeHop[] };
  for (const hops of candidates) {
    const q = await quoteAerodromePath(amountIn, hops);
    if (q.amountOut > best.amountOut) best = q;
  }
  return best;
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
  hops?: AerodromeHop[];
}): Hex {
  const routes =
    params.hops && params.hops.length > 0
      ? buildMultiRoute(params.hops)
      : buildRoute(WETH_BASE as Address, params.tokenOut, params.stable ?? false);
  return encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: "swapExactETHForTokens",
    args: [params.amountOutMinimum, routes, params.recipient, swapDeadline()],
  });
}

export function encodeAerodromeSell(params: {
  tokenIn: Address;
  recipient: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
  stable?: boolean;
  hops?: AerodromeHop[];
}): Hex {
  const routes =
    params.hops && params.hops.length > 0
      ? buildMultiRoute(params.hops)
      : buildRoute(params.tokenIn, WETH_BASE as Address, params.stable ?? false);
  return encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: "swapExactTokensForETH",
    args: [
      params.amountIn,
      params.amountOutMinimum,
      routes,
      params.recipient,
      swapDeadline(),
    ],
  });
}

export { ROUTER_ABI };
