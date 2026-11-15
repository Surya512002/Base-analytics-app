/**
 * Swap tab: ETH ↔ tokenized stock on real Base, in simulation only (eth_simulateV1; nothing is
 * signed). Stocks only pair with USDC, so the quote must find the one-call WETH → USDC → stock
 * Slipstream route, and the sell must come back to native ETH.
 */
import { describe, expect, it } from "vitest";
import { createPublicClient, erc20Abi, http, parseUnits, type Address } from "viem";
import { base } from "viem/chains";
import { quoteLaunchSwap } from "@/lib/launchpad/dex";
import { encodeSlipstreamPathSwap, encodeSlipstreamPathSwapToEth, SLIPSTREAM_V2_ROUTER } from "@/lib/launchpad/slipstream";
import { WETH_BASE } from "@/lib/launchpad/uniswap";
import { buildContractCall, encodeContractCall, finalizeAppTransactionBatch, hasBuilderSuffix } from "@/lib/utils/tx";

const RPC = process.env.ZAP_RPC_URL || "https://base-rpc.publicnode.com";
const client = createPublicClient({ chain: base, transport: http(RPC, { timeout: 60_000 }) });
const WALLET = (process.env.CHECKUP_WALLET || "0xbCDDd1bc8F3c0c24BEDEE41720287ff50a7B7148") as Address;
const AMDC = "0xB2000000000000000000000d8Ce462E99ee7A47B" as Address;

describe("Swap: ETH ↔ stock through USDC (real Base)", { timeout: 300_000 }, () => {
  it("buys AMDc with ETH and sells it back to ETH, every call succeeding in order", async () => {
    const amountIn = parseUnits("0.005", 18);
    const buy = await quoteLaunchSwap({ token: AMDC, direction: "buy", amountIn, slippageBps: 100, dex: "auto", quoteToken: WETH_BASE as Address });
    expect(buy.hasLiquidity).toBe(true);
    expect(buy.dex).toBe("slipstream");
    expect(buy.slipstreamPath).toBeTruthy();
    expect(buy.router.toLowerCase()).toBe(SLIPSTREAM_V2_ROUTER.toLowerCase());

    const sellAmount = buy.amountOutMinimum;
    const sell = await quoteLaunchSwap({ token: AMDC, direction: "sell", amountIn: sellAmount, slippageBps: 100, dex: "auto", quoteToken: WETH_BASE as Address });
    expect(sell.hasLiquidity).toBe(true);
    expect(sell.slipstreamPath).toBeTruthy();

    const calls = finalizeAppTransactionBatch([
      buildContractCall(buy.router, encodeSlipstreamPathSwap({ path: buy.slipstreamPath!, recipient: WALLET, amountIn, amountOutMinimum: buy.amountOutMinimum }), amountIn),
      encodeContractCall(AMDC, erc20Abi, "approve", [sell.router, sellAmount]),
      buildContractCall(sell.router, encodeSlipstreamPathSwapToEth({ path: sell.slipstreamPath!, recipient: WALLET, amountIn: sellAmount, amountOutMinimum: sell.amountOutMinimum })),
    ]);
    for (const c of calls) expect(hasBuilderSuffix(c.data)).toBe(true);

    const sim = await client.simulateCalls({
      account: WALLET,
      calls: [
        { to: AMDC, abi: erc20Abi, functionName: "balanceOf", args: [WALLET] },
        ...calls.map((c) => ({ to: c.to, data: c.data, value: c.value })),
        { to: AMDC, abi: erc20Abi, functionName: "balanceOf", args: [WALLET] },
      ],
      stateOverrides: [{ address: WALLET, balance: parseUnits("1", 18) }],
    });
    sim.results.forEach((r, i) => expect(r.status, `call ${i}: ${String((r as { error?: Error }).error?.message ?? "").slice(0, 200)}`).toBe("success"));
    // Bought at least the minimum, sold exactly that back: the stock balance ends where it started (± the buy's surplus).
    const before = sim.results[0].result as unknown as bigint;
    const after = sim.results[sim.results.length - 1].result as unknown as bigint;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});
