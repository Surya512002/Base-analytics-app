import { describe, expect, it } from "vitest";
import { buildLaunchBoard, trendingScore, toBoardRow } from "@/lib/launchpad/launch-board";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";

const NOW = Date.parse("2026-11-13T12:00:00Z");
const H = 3600_000;

const tok = (addr: string, ageH: number, extra: Partial<LaunchedToken> = {}): LaunchedToken => ({
  address: addr,
  name: addr,
  symbol: addr.slice(0, 4).toUpperCase(),
  decimals: 18,
  creator: "0x0",
  txHash: "0x0",
  createdAt: NOW - ageH * H,
  ...extra,
});

const mkt = (addr: string, buys: number, sells: number, vol: number): TokenMarketSummary => ({
  address: addr,
  priceUsd: 1,
  priceNative: null,
  marketCap: 1000,
  fdv: 1000,
  volume24h: vol,
  liquidityUsd: 100,
  priceChange24h: 5,
  txns24h: buys + sells,
  buys24h: buys,
  sells24h: sells,
  dexId: "uniswap",
  pairAddress: null,
  hasPool: true,
});

describe("launch board", () => {
  it("does not rank tokens with no activity", () => {
    expect(trendingScore(toBoardRow(tok("0xa", 1), undefined), NOW)).toBe(0);
  });

  it("boosts launches under 6 hours old", () => {
    const fresh = toBoardRow(tok("0xa", 2), mkt("0xa", 10, 5, 1000));
    const old = toBoardRow(tok("0xb", 30), mkt("0xb", 10, 5, 1000));
    expect(trendingScore(fresh, NOW)).toBeGreaterThan(trendingScore(old, NOW));
  });

  it("builds stats, trending (active only) and newest-first lists", () => {
    const tokens = [tok("0xa", 30), tok("0xb", 2), tok("0xc", 1, { liquidityLocked: true })];
    const markets = { "0xa": mkt("0xa", 100, 50, 50_000), "0xb": mkt("0xb", 3, 1, 200) };
    const { stats, trending, justLaunched } = buildLaunchBoard(tokens, markets, NOW);
    expect(stats).toMatchObject({ launched: 3, launchedToday: 2, buys24h: 103, sells24h: 51, trades24h: 154, volume24h: 50_200 });
    expect(trending.map((r) => r.address)).toEqual(["0xa", "0xb"]);
    expect(justLaunched.map((r) => r.address)).toEqual(["0xc", "0xb", "0xa"]);
    expect(justLaunched[0].liquidityLocked).toBe(true);
  });
});
