import { encodeFunctionData, parseEther, parseUnits } from "viem";
import type { Address, Hex } from "viem";
import { encodeB20ApproveCalldata } from "@/lib/b20/encode";
import { AERODROME_ROUTER } from "@/lib/launchpad/aerodrome";
import { buildContractCall, type ContractCall } from "@/lib/utils/tx";

const ADD_LIQUIDITY_ETH_ABI = [
  {
    name: "addLiquidityETH",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "stable", type: "bool" },
      { name: "amountTokenDesired", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [
      { name: "amountToken", type: "uint256" },
      { name: "amountETH", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
  },
] as const;

function liquidityDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
}

export function encodeAerodromeAddLiquidityETH(params: {
  token: Address;
  amountTokenDesired: bigint;
  recipient: Address;
  amountTokenMin?: bigint;
  amountETHMin?: bigint;
}): Hex {
  return encodeFunctionData({
    abi: ADD_LIQUIDITY_ETH_ABI,
    functionName: "addLiquidityETH",
    args: [
      params.token,
      false,
      params.amountTokenDesired,
      params.amountTokenMin ?? BigInt(0),
      params.amountETHMin ?? BigInt(0),
      params.recipient,
      liquidityDeadline(),
    ],
  });
}

/** Token count to pair with ETH at launch list price. */
export function computeLiquiditySeedAmounts(params: {
  seedEth: string;
  startPriceUsd: string;
  ethUsd: number;
  decimals?: number;
}): { ethWei: bigint; tokenWei: bigint; tokenHuman: number } | null {
  const eth = parseFloat(params.seedEth);
  if (!Number.isFinite(eth) || eth <= 0) return null;
  const priceUsd = parseFloat(params.startPriceUsd);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;
  if (params.ethUsd <= 0) return null;

  const priceEth = priceUsd / params.ethUsd;
  const tokenHuman = eth / priceEth;
  if (!Number.isFinite(tokenHuman) || tokenHuman < 1) return null;

  const dec = params.decimals ?? 18;
  const tokenWei = parseUnits(String(Math.floor(tokenHuman)), dec);
  let ethWei: bigint;
  try {
    ethWei = parseEther(params.seedEth);
  } catch {
    return null;
  }
  if (tokenWei <= BigInt(0) || ethWei <= BigInt(0)) return null;
  return { ethWei, tokenWei, tokenHuman: Math.floor(tokenHuman) };
}

export function buildSeedLiquidityCalls(params: {
  token: `0x${string}`;
  creator: `0x${string}`;
  tokenAmount: bigint;
  ethAmount: bigint;
}): ContractCall[] {
  return [
    buildContractCall(
      params.token,
      encodeB20ApproveCalldata(AERODROME_ROUTER, params.tokenAmount)
    ),
    buildContractCall(
      AERODROME_ROUTER,
      encodeAerodromeAddLiquidityETH({
        token: params.token,
        amountTokenDesired: params.tokenAmount,
        recipient: params.creator,
      }),
      params.ethAmount
    ),
  ];
}

export const DEFAULT_SEED_LIQUIDITY_ETH = "0.001";

export const SEED_LIQUIDITY_PRESETS = [
  "0.0005",
  "0.001",
  "0.01",
  "0.05",
  "0.1",
  "0.25",
] as const;

export function seedEthUsdValue(seedEth: string, ethUsd: number): number | null {
  const eth = parseFloat(seedEth);
  if (!Number.isFinite(eth) || eth <= 0 || ethUsd <= 0) return null;
  return eth * ethUsd;
}
