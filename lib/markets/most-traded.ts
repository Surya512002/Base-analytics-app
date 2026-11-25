import type { StockMarketItem } from "./types";

const volume = (s: StockMarketItem) => Object.values(s.appVolumes).reduce((sum, v) => sum + v, 0);

/** The stocks with the most 24-hour trading, largest first. Stocks with no trades are left out. */
export function mostTraded(stocks: StockMarketItem[], count: number): StockMarketItem[] {
  return stocks
    .filter((s) => volume(s) > 0)
    .sort((a, b) => volume(b) - volume(a))
    .slice(0, count);
}
