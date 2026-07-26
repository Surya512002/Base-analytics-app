import { describe, expect, it } from "vitest";
import { inferPreferredDex, pickRoutingPair } from "@/lib/launchpad/routing-pairs";
import { WETH_BASE } from "@/lib/launchpad/uniswap";
import { USDC_BASE } from "@/lib/launchpad/tokens-base";

describe("pickRoutingPair", () => {
  it("prefers WETH pair over deeper USDC pair", () => {
    const token = "0xb200000000000000000000000000000000000001";
    const pair = pickRoutingPair(
      [
        {
          chainId: "base",
          dexId: "aerodrome",
          liquidity: { usd: 500_000 },
          baseToken: { address: token },
          quoteToken: { address: USDC_BASE },
        },
        {
          chainId: "base",
          dexId: "slipstream",
          liquidity: { usd: 50_000 },
          baseToken: { address: token },
          quoteToken: { address: WETH_BASE },
        },
      ],
      token
    );
    expect(pair?.counterKind).toBe("weth");
    expect(pair?.dexId).toBe("slipstream");
  });
});

describe("inferPreferredDex", () => {
  it("maps dexscreener ids to venues", () => {
    expect(inferPreferredDex("aerodrome")).toBe("aerodrome");
    expect(inferPreferredDex("uniswap")).toBe("uniswap");
    expect(inferPreferredDex("aerodrome-slipstream")).toBe("slipstream");
  });
});
