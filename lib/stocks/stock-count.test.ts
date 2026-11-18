import { describe, expect, it } from "vitest";
import { BASE_VERIFIED_STOCKS } from "./base-verified";
import { LIVE_STOCK_COUNT, stockCountLabel, TOKENIZED_STOCKS_LABEL } from "./stock-count";

describe("TOKENIZED_STOCKS_LABEL", () => {
  it("is the real number of live stocks the app offers", () => {
    expect(TOKENIZED_STOCKS_LABEL).toBe(String(BASE_VERIFIED_STOCKS.length));
    expect(LIVE_STOCK_COUNT).toBe(BASE_VERIFIED_STOCKS.length);
  });
  it("rounds down to the nearest 10 for round-number copy", () => {
    expect(stockCountLabel(87)).toBe("80+");
    expect(stockCountLabel(120)).toBe("120+");
    expect(stockCountLabel(7)).toBe("7");
  });
});
