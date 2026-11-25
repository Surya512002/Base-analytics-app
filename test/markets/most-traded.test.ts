import { describe, it, expect } from "vitest";
import { mostTraded } from "@/lib/markets/most-traded";
import type { StockMarketItem } from "@/lib/markets/types";

const stock = (symbol: string, appVolumes: Record<string, number>) => ({ symbol, appVolumes }) as unknown as StockMarketItem;

describe("mostTraded", () => {
  it("ranks by volume across venues and leaves out untraded stocks", () => {
    const list = [stock("A", { x: 5 }), stock("B", {}), stock("C", { x: 4, y: 4 }), stock("D", { x: 1 })];
    expect(mostTraded(list, 2).map((s) => s.symbol)).toEqual(["C", "A"]);
    expect(mostTraded(list, 10).map((s) => s.symbol)).toEqual(["C", "A", "D"]);
  });
});
