import { describe, expect, it } from "vitest";
import {
  buildHotTokens,
  buildBaseTopMovers,
  buildRecentlyAppLaunched,
  tokenSafetyLevel,
} from "@/lib/launchpad/explore-rankings";
import type { LaunchedToken } from "@/lib/launchpad/types";

const token = (
  addr: string,
  symbol: string,
  extra: Partial<LaunchedToken> = {}
): LaunchedToken => ({
  address: addr,
  symbol,
  name: symbol,
  decimals: 18,
  creator: "0x0000000000000000000000000000000000000001",
  createdAt: Date.now(),
  txHash: "0x" + "a".repeat(64),
  ...extra,
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

describe("buildRecentlyAppLaunched", () => {
  it("keeps only platform launches and sorts newest first", () => {
    const appOld = token("0xb200000000000000000000000000000000000001", "OLD", {
      source: "launched",
      createdAt: 1_000,
    });
    const appNew = token("0xb200000000000000000000000000000000000002", "NEW", {
      source: "launched",
      createdAt: 2_000,
    });
    const factory = token("0xb200000000000000000000000000000000000003", "FAC", {
      source: "b20",
      createdAt: 3_000,
    });
    const external = token("0x3333333333333333333333333333333333333333", "EXT", {
      source: "external",
      createdAt: 4_000,
    });

    const recent = buildRecentlyAppLaunched(
      [appOld, factory, external, appNew],
      8
    );
    expect(recent.map((t) => t.symbol)).toEqual(["NEW", "OLD"]);
  });
});

describe("buildBaseTopMovers", () => {
  it("prioritizes positive 24h movers with liquidity", () => {
    const b20 = token("0xb200000000000000000000000000000000000001", "B20A");
    const eco = token("0x3333333333333333333333333333333333333333", "ECO");
    const markets = {
      [b20.address.toLowerCase()]: {
        hasPool: true,
        liquidityUsd: 50_000,
        volume24h: 10_000,
        priceChange24h: 12.5,
      },
      [eco.address.toLowerCase()]: {
        hasPool: true,
        liquidityUsd: 80_000,
        volume24h: 20_000,
        priceChange24h: 8.2,
      },
    } as Record<string, import("@/lib/launchpad/dexscreener").TokenMarketSummary>;

    const movers = buildBaseTopMovers([b20, eco], markets, 2);
    expect(movers.map((t) => t.symbol)).toEqual(["B20A", "ECO"]);
  });
});
