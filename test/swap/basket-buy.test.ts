import { describe, expect, it } from "vitest";
import { decodeFunctionData, erc20Abi, parseAbi, type Address } from "viem";
import { buildBasketCalls, type BasketLeg } from "@/lib/swap/basket-buy";
import { buildSwapZapOrder } from "@/lib/swap/zap-batch";
import { resolveSwapLegs } from "@/lib/launchpad/swap-assets";
import { SLIPSTREAM_V2_ROUTER } from "@/lib/launchpad/slipstream";
import { LAUNCHPAD_TREASURY } from "@/lib/constants/launchpad";
import { USDC_BASE } from "@/lib/launchpad/tokens-base";
import { assertTrustedApprovals } from "@/lib/security/trusted-spenders";
import { assertBuilderAttribution, finalizeAppTransactionBatch, stripBuilderSuffix } from "@/lib/utils/tx";
import type { SwapQuoteResponse } from "@/lib/api/launchpad-client";

const BUYER = "0x1111111111111111111111111111111111111111" as Address;
const router = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,int24 tickSpacing,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256)",
]);

const leg = (symbol: string, tail: string, usdc: string, net: string, extra: Partial<SwapQuoteResponse> = {}): BasketLeg => ({
  symbol,
  token: `0xb2000000000000000000000000000000000000${tail}`,
  usdc,
  quote: { hasLiquidity: true, dex: "slipstream", router: SLIPSTREAM_V2_ROUTER, slipstreamTickSpacing: 10, amountIn: net, amountOut: "1000", amountOutMinimum: "990", tokenIn: USDC_BASE, tokenOut: "", ...extra },
});
// $10.00 and $5.00 with the 0.25% fee taken off.
const legs = [leg("NVDAc", "01", "10.00", "9975000"), leg("AAPLc", "02", "5.00", "4987500")];

describe("basket buy", () => {
  it("approves once per router, swaps each stock to the buyer and takes one fee", () => {
    const plan = buildBasketCalls(BUYER, legs);
    if (!plan.ok) throw new Error(plan.error);
    expect([plan.total, plan.fee, plan.calls.length]).toEqual([BigInt(15_000_000), BigInt(37_500), 4]);
    const approve = decodeFunctionData({ abi: erc20Abi, data: stripBuilderSuffix(plan.calls[0]!.data) });
    expect(approve.args).toEqual([SLIPSTREAM_V2_ROUTER, BigInt(14_962_500)]);
    for (const [i, l] of legs.entries()) {
      const swap = decodeFunctionData({ abi: router, data: stripBuilderSuffix(plan.calls[i + 1]!.data) }).args[0];
      expect([swap.tokenOut.toLowerCase(), swap.recipient, swap.amountIn, swap.amountOutMinimum]).toEqual([l.token, BUYER, BigInt(l.quote.amountIn), BigInt(990)]);
    }
    const fee = decodeFunctionData({ abi: erc20Abi, data: stripBuilderSuffix(plan.calls[3]!.data) });
    expect(fee.args).toEqual([LAUNCHPAD_TREASURY, BigInt(37_500)]);
    // The same checks every app transaction goes through.
    assertTrustedApprovals(plan.calls);
    assertBuilderAttribution(finalizeAppTransactionBatch(plan.calls));
    // Browser wallets: the whole basket fits one order pulling exactly the total.
    expect(buildSwapZapOrder(BUYER, plan.calls)!.inputs).toEqual([{ token: USDC_BASE, amount: BigInt(15_000_000) }]);
  });

  it("skips the approval when enough is already approved", () => {
    const plan = buildBasketCalls(BUYER, legs, new Map([[SLIPSTREAM_V2_ROUTER.toLowerCase(), BigInt(15_000_000)]]));
    expect(plan.ok && plan.calls.length).toBe(3);
  });

  it("sends nothing when any stock is unsafe or out of date", () => {
    const bad: Partial<SwapQuoteResponse>[] = [
      { hasLiquidity: false },
      { router: "0x2222222222222222222222222222222222222222" },
      { dex: "aggregator" },
      { amountOutMinimum: "0" },
      { amountIn: "1" },
    ];
    for (const extra of bad) expect(buildBasketCalls(BUYER, [legs[0]!, leg("AAPLc", "02", "5.00", "4987500", extra)]).ok).toBe(false);
  });
});

describe("USDC picked from the token list", () => {
  it("uses the direct pools, not only the aggregator", () => {
    const buy = resolveSwapLegs({ pageToken: legs[0]!.token, direction: "buy", payAsset: "token", payToken: USDC_BASE.toLowerCase() });
    expect([buy!.canUseDirectDex, buy!.payAsset, buy!.amountDecimals]).toEqual([true, "usdc", 6]);
    const sell = resolveSwapLegs({ pageToken: legs[0]!.token, direction: "sell", receiveAsset: "token", receiveToken: USDC_BASE });
    expect([sell!.canUseDirectDex, sell!.receiveAsset, sell!.outDecimals]).toEqual([true, "usdc", 6]);
  });
});
