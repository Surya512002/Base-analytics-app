import { describe, expect, it } from "vitest";
import { decodeFunctionData, isAddress, parseAbi } from "viem";
import { buildSeedLiquidityCalls, encodeAerodromeAddLiquidityETH } from "./seed-liquidity";
import { UNISWAP_NPM } from "./uniswap-seed";
import { O1_TRADING_ROUTER_BASE } from "@/lib/trading/o1-api";
import { isTrustedSpender } from "@/lib/security/trusted-spenders";
import { getBuilderDataSuffix, stripBuilderSuffix, hasBuilderSuffix } from "@/lib/utils/tx";
import { builderDataSuffix } from "@/limit-orders/shared/builderCode";

const token = "0xb20000000000000000000078ee7ce2fe4908108c" as const;
const creator = "0x1111111111111111111111111111111111111111" as const;
const TOKENS = BigInt("1000000000000000000000");
const ETH = BigInt("1000000000000000");
const abi = parseAbi([
  "function multicall(bytes[] data) payable returns (bytes[])",
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline) params) payable returns (uint256,uint128,uint256,uint256)",
  "function refundETH() payable",
  "function addLiquidityETH(address token,bool stable,uint256 amountTokenDesired,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) payable returns (uint256,uint256,uint256)",
]);

const uniswapSteps = (newPool: boolean) => {
  const call = buildSeedLiquidityCalls({ token, creator, tokenAmount: TOKENS, ethAmount: ETH, dex: "uniswap", newPool })[1]!;
  const [steps] = decodeFunctionData({ abi, data: stripBuilderSuffix(call.data) }).args as [readonly `0x${string}`[]];
  return { call, steps };
};

describe("pool seeding", () => {
  it("uses a real, trusted Uniswap position manager", () => {
    expect(isAddress(UNISWAP_NPM)).toBe(true);
    expect(isTrustedSpender(UNISWAP_NPM)).toBe(true);
  });

  it("returns unused ETH to the wallet", () => {
    const { call, steps } = uniswapSteps(false);
    expect(call.to).toBe(UNISWAP_NPM);
    expect(hasBuilderSuffix(call.data)).toBe(true);
    expect(decodeFunctionData({ abi, data: steps.at(-1)! }).functionName).toBe("refundETH");
  });

  it("refuses a different price when the pool should be new", () => {
    const min = (newPool: boolean) => {
      const mint = decodeFunctionData({ abi, data: uniswapSteps(newPool).steps[1]! }).args![0] as { amount0Min: bigint; amount1Min: bigint };
      return [mint.amount0Min, mint.amount1Min];
    };
    expect(min(false)).toEqual([BigInt(0), BigInt(0)]);
    expect(min(true).every((m) => m > BigInt(0))).toBe(true);

    const aero = buildSeedLiquidityCalls({ token, creator, tokenAmount: TOKENS, ethAmount: ETH, newPool: true })[1]!;
    const args = decodeFunctionData({ abi, data: stripBuilderSuffix(aero.data) }).args as readonly unknown[];
    expect(args[3]).toBe((TOKENS * BigInt(99)) / BigInt(100));
    expect(args[4]).toBe((ETH * BigInt(99)) / BigInt(100));
  });

  it("keeps manual top-ups of an existing pool unchanged", () => {
    const aero = buildSeedLiquidityCalls({ token, creator, tokenAmount: TOKENS, ethAmount: ETH })[1]!;
    const plain = encodeAerodromeAddLiquidityETH({ token, amountTokenDesired: TOKENS, recipient: creator });
    // The deadline word differs by clock; everything before it must match.
    expect(stripBuilderSuffix(aero.data).slice(0, -64)).toBe(plain.slice(0, -64));
  });
});

describe("approvals and attribution", () => {
  it("does not trust the o1 address, which has no contract on Base", () => {
    expect(isTrustedSpender(O1_TRADING_ROUTER_BASE)).toBe(false);
  });

  it("gives the order keeper the same builder code as the app", () => {
    expect(builderDataSuffix("bc_4uoh9iu2")).toBe(getBuilderDataSuffix());
  });
});
