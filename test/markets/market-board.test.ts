import { describe, expect, it } from "vitest";
import { mostTradedItems, newestLaunches, topGainers, topLosers, treemap, type MarketItem } from "@/lib/markets/board";

const item = (symbol: string, change24h: number | null, volume24h: number | null, extra: Partial<MarketItem> = {}): MarketItem => ({
  kind: "stock",
  address: `0x${symbol}`,
  symbol,
  name: symbol,
  decimals: 8,
  priceUsd: 10,
  change24h,
  volume24h,
  liquidityUsd: null,
  ...extra,
});

const items = [
  item("UP", 4, 50_000),
  item("BIG", 1, 900_000),
  item("DOWN", -3, 20_000),
  // None of these may be ranked: dust volume, thin pool, no price.
  item("DUST", 900, 50),
  item("THIN", 500, 80_000, { kind: "token", liquidityUsd: 900 }),
  item("NEW", null, null, { kind: "launched", priceUsd: null, createdAt: 2 }),
  item("OLD", null, null, { kind: "launched", priceUsd: null, createdAt: 1 }),
];
const names = (list: MarketItem[]) => list.map((x) => x.symbol);

describe("market board", () => {
  it("ranks only markets with real trading behind them", () => {
    expect(names(topGainers(items, 5))).toEqual(["UP", "BIG"]);
    expect(names(topLosers(items, 5))).toEqual(["DOWN"]);
    expect(names(mostTradedItems(items, 5))).toEqual(["BIG", "UP", "DOWN"]);
    expect(names(newestLaunches(items, 1))).toEqual(["NEW"]);
  });

  it("fills the whole heatmap with one box per item, sized by weight", () => {
    const rects = treemap([6, 3, 2, 1, 0].map((weight) => ({ item: weight, weight })), 2.5);
    expect(rects.map((r) => r.item)).toEqual([6, 3, 2, 1]);
    for (const r of rects) expect(r.w * r.h).toBeCloseTo((r.item / 12) * 10_000, 5);
    for (const r of rects) expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= 100.001 && r.y + r.h <= 100.001).toBe(true);
  });
});
