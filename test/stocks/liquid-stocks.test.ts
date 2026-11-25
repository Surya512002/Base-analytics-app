import { describe, expect, it } from "vitest";
import { BASE_STOCKS } from "@/lib/stocks/base-stocks";
import { COINBASE_LIQUID_STOCKS, COINBASE_LIVE_STOCKS } from "@/lib/stocks/live-stocks.generated";
import { getActiveTokenizedStocks } from "@/lib/stocks/tokenized-stocks-registry";

describe("stocks shown in market lists", () => {
  const shown = new Set(getActiveTokenizedStocks().map((s) => s.address.toLowerCase()));

  it("includes every stock with real trading liquidity, each once", () => {
    for (const address of COINBASE_LIQUID_STOCKS) expect(shown.has(address), address).toBe(true);
    expect(shown.size).toBe(getActiveTokenizedStocks().length);
    expect(BASE_STOCKS.length).toBe(shown.size);
  });

  it("only calls a stock liquid when it is also live", () => {
    const live = new Set(COINBASE_LIVE_STOCKS.map(([, , a]) => a.toLowerCase()));
    for (const address of COINBASE_LIQUID_STOCKS) expect(live.has(address), address).toBe(true);
    expect(COINBASE_LIQUID_STOCKS.length).toBeGreaterThan(0);
  });
});
