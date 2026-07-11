import { encodeFunctionData } from "viem";
import type { Address, Hex } from "viem";
import { encodeB20ApproveCalldata } from "@/lib/b20/encode";
import { WETH_BASE } from "@/lib/launchpad/uniswap";
import { buildContractCall, type ContractCall } from "@/lib/utils/tx";

/** Uniswap V3 NonfungiblePositionManager on Base. */
export const UNISWAP_NPM =
  "0x03a520b32C04e3bEEf1BEEB66a447cdf628e634" as const;

export const UNISWAP_V3_SEED_FEE = 3000;

/** Full-range ticks aligned to 0.3% fee tier (spacing 60). */
const TICK_LOWER = -887220;
const TICK_UPPER = 887220;

const NPM_ABI = [
  {
    name: "createAndInitializePoolIfNecessary",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "sqrtPriceX96", type: "uint160" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "token0", type: "address" },
          { name: "token1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickLower", type: "int24" },
          { name: "tickUpper", type: "int24" },
          { name: "amount0Desired", type: "uint256" },
          { name: "amount1Desired", type: "uint256" },
          { name: "amount0Min", type: "uint256" },
          { name: "amount1Min", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
    outputs: [
      { name: "tokenId", type: "uint256" },
      { name: "liquidity", type: "uint128" },
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
  },
  {
    name: "multicall",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
] as const;

function liquidityDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
}

function bigintSqrt(value: bigint): bigint {
  if (value <= BigInt(0)) return BigInt(0);
  const x = value;
  let z = (x + BigInt(1)) / BigInt(2);
  let y = x;
  while (z < y) {
    y = z;
    z = (x / z + z) / BigInt(2);
  }
  return y;
}

/** sqrtPriceX96 = sqrt(amount1/amount0) * 2^96 (Uniswap token0/token1 ordering). */
export function sqrtPriceX96FromAmounts(amount0: bigint, amount1: bigint): bigint {
  if (amount0 <= BigInt(0) || amount1 <= BigInt(0)) return BigInt(0);
  const ratioX192 = (amount1 << BigInt(192)) / amount0;
  return bigintSqrt(ratioX192);
}

export function sortTokenPair(
  tokenA: Address,
  tokenB: Address
): [Address, Address] {
  return tokenA.toLowerCase() < tokenB.toLowerCase()
    ? [tokenA, tokenB]
    : [tokenB, tokenA];
}

export function buildUniswapV3SeedCalls(params: {
  token: `0x${string}`;
  creator: `0x${string}`;
  tokenAmount: bigint;
  ethAmount: bigint;
  fee?: number;
}): ContractCall[] {
  const weth = WETH_BASE as Address;
  const [token0, token1] = sortTokenPair(weth, params.token);
  const wethIsToken0 = token0.toLowerCase() === weth.toLowerCase();
  const amount0 = wethIsToken0 ? params.ethAmount : params.tokenAmount;
  const amount1 = wethIsToken0 ? params.tokenAmount : params.ethAmount;
  const fee = params.fee ?? UNISWAP_V3_SEED_FEE;
  const sqrtPriceX96 = sqrtPriceX96FromAmounts(amount0, amount1);
  if (sqrtPriceX96 <= BigInt(0)) {
    throw new Error("Invalid Uniswap seed price");
  }

  const createPool: Hex = encodeFunctionData({
    abi: NPM_ABI,
    functionName: "createAndInitializePoolIfNecessary",
    args: [token0, token1, fee, sqrtPriceX96],
  });

  const mint: Hex = encodeFunctionData({
    abi: NPM_ABI,
    functionName: "mint",
    args: [
      {
        token0,
        token1,
        fee,
        tickLower: TICK_LOWER,
        tickUpper: TICK_UPPER,
        amount0Desired: amount0,
        amount1Desired: amount1,
        amount0Min: BigInt(0),
        amount1Min: BigInt(0),
        recipient: params.creator,
        deadline: liquidityDeadline(),
      },
    ],
  });

  const multicall: Hex = encodeFunctionData({
    abi: NPM_ABI,
    functionName: "multicall",
    args: [[createPool, mint]],
  });

  return [
    buildContractCall(
      params.token,
      encodeB20ApproveCalldata(UNISWAP_NPM, params.tokenAmount)
    ),
    buildContractCall(UNISWAP_NPM, multicall, params.ethAmount),
  ];
}
