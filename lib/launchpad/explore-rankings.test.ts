import { describe, expect, it } from "vitest";
import { buildHotTokens, tokenSafetyLevel } from "@/lib/launchpad/explore-rankings";
import type { LaunchedToken } from "@/lib/launchpad/types";

const token = (addr: string, symbol: string): LaunchedToken => ({
  address: addr,
  symbol,
  name: symbol,
  decimals: 18,
  creator: "0x0000000000000000000000000000000000000001",
  createdAt: Date.now(),
  txHash: "0x" + "a".repeat(64),
});

describe("tokenSafetyLevel", () => {
  it("labels pooled vs low liquidity", () => {
    expect(tokenSafetyLevel({ hasPool: true, liquidityUsd: 10_000 } as never)).toBe("pooled");
    expect(tokenSafetyLevel({ hasPool: true, liquidityUsd: 2_000 } as never)).toBe("low");
  });
});

describe("buildHotTokens", () => {
  it("ranks by recent activity", () => {
    const t1 = token("0x1111111111111111111111111111111111111111", "AAA");
    const t2 = token("0x2222222222222222222222222222222222222222", "BBB");
    const hot = buildHotTokens(
      [
        {
          type: "swap",
          token: t1.address,
          symbol: "AAA",
          name: "A",
          timestamp: Date.now() - 1000,
          label: "swap",
        },
        {
          type: "swap",
          token: t1.address,
          symbol: "AAA",
          name: "A",
          timestamp: Date.now() - 2000,
          label: "swap",
        },
      ],
      [t1, t2],
      {
        [t1.address.toLowerCase()]: { volume24h: 100, hasPool: true },
        [t2.address.toLowerCase()]: { volume24h: 50, hasPool: true },
      } as Record<string, import("@/lib/launchpad/dexscreener").TokenMarketSummary>,
      2
    );
    expect(hot[0]?.address).toBe(t1.address);
  });
});
