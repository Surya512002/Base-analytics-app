import { describe, expect, it, vi } from "vitest";

const out = (amountOut: number) => ({ amountOut: BigInt(amountOut), hasLiquidity: amountOut > 0 });

vi.mock("@/lib/launchpad/uniswap", async (load) => ({
  ...(await load<typeof import("@/lib/launchpad/uniswap")>()),
  // A thin direct pool.
  quoteSwapExactIn: vi.fn(async () => ({ ...out(20), feeTier: 10000 })),
  quoteUniswapMultiHop: vi.fn(),
}));
vi.mock("@/lib/launchpad/aerodrome", async (load) => ({
  ...(await load<typeof import("@/lib/launchpad/aerodrome")>()),
  quoteAerodromeExactIn: vi.fn(async () => ({ ...out(0), stable: false })),
  quoteAerodromeUsdcHop: vi.fn(async () => ({ ...out(0), hops: [] })),
}));
vi.mock("@/lib/launchpad/slipstream", async (load) => ({
  ...(await load<typeof import("@/lib/launchpad/slipstream")>()),
  quoteSlipstreamExactIn: vi.fn(async () => ({ ...out(0), tickSpacing: 1, router: "0x1111111111111111111111111111111111111111" })),
  quoteSlipstreamV2ViaUsdc: vi.fn(async () => ({ ...out(34), path: "0xabcd", router: "0x2222222222222222222222222222222222222222" })),
}));

import { quoteLaunchSwap } from "./dex";
import { quoteUniswapMultiHop } from "@/lib/launchpad/uniswap";

const params = { token: "0xb20000000000000000000019f6e7c675b73c2e4d" as const, direction: "buy" as const, amountIn: BigInt(1000), slippageBps: 100, compareViaUsdc: true };

describe("quoteLaunchSwap", () => {
  it("takes a two-pool route that pays more than a thin direct pool, without the slow lookups", async () => {
    const q = await quoteLaunchSwap(params);
    expect([q.dex, q.amountOut, q.slipstreamPath, q.router]).toEqual(["slipstream", BigInt(34), "0xabcd", "0x2222222222222222222222222222222222222222"]);
    expect(quoteUniswapMultiHop).not.toHaveBeenCalled();
  });

  it("does not spend time on two-pool routes for other tokens that have a direct pool", async () => {
    expect((await quoteLaunchSwap({ ...params, compareViaUsdc: false })).amountOut).toBe(BigInt(20));
  });

  it("stays on the direct pool when two-pool routes are not allowed or a venue is chosen", async () => {
    expect((await quoteLaunchSwap({ ...params, allowUsdcHop: false })).amountOut).toBe(BigInt(20));
    expect((await quoteLaunchSwap({ ...params, dex: "uniswap" })).amountOut).toBe(BigInt(20));
  });
});
