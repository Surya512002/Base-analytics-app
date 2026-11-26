import { describe, expect, it, vi } from "vitest";

const none = { amountOut: BigInt(0), hasLiquidity: false };

vi.mock("@/lib/launchpad/uniswap", async (load) => ({
  ...(await load<typeof import("@/lib/launchpad/uniswap")>()),
  quoteSwapExactIn: vi.fn(async () => ({ amountOut: BigInt(0), hasLiquidity: false, feeTier: 3000 })),
}));
vi.mock("@/lib/launchpad/aerodrome", async (load) => ({
  ...(await load<typeof import("@/lib/launchpad/aerodrome")>()),
  quoteAerodromeExactIn: vi.fn(async () => ({ amountOut: BigInt(0), hasLiquidity: false, stable: false })),
}));
vi.mock("@/lib/launchpad/slipstream", async (load) => ({
  ...(await load<typeof import("@/lib/launchpad/slipstream")>()),
  quoteSlipstreamExactIn: vi.fn(async () => ({ ...none, tickSpacing: 1, router: "0x1111111111111111111111111111111111111111" })),
  quoteSlipstreamV2ViaUsdc: vi.fn(async () => ({ amountOut: BigInt(34), hasLiquidity: true, path: "0xabcd", router: "0x2222222222222222222222222222222222222222" })),
}));

import { quoteLaunchSwap } from "@/lib/launchpad/dex";

describe("choosing the Slipstream router", () => {
  it("uses the two-pool stock route when there is no direct pool", async () => {
    const q = await quoteLaunchSwap({ token: "0xb20000000000000000000019f6e7c675b73c2e4d", direction: "buy", amountIn: BigInt(1000), slippageBps: 100, dex: "slipstream" });
    expect([q.dex, q.hasLiquidity, q.slipstreamPath, q.router]).toEqual(["slipstream", true, "0xabcd", "0x2222222222222222222222222222222222222222"]);
  });
});
