import { describe, expect, it } from "vitest";
import { BASE_VERIFIED_STOCKS } from "./base-verified";
import { stockCountLabel, TOKENIZED_STOCKS_LABEL } from "./stock-count";

describe("TOKENIZED_STOCKS_LABEL", () => {
  it("matches the real number of supported stocks", () => {
    // If this fails, the stock list grew: update TOKENIZED_STOCKS_LABEL.
    expect(TOKENIZED_STOCKS_LABEL).toBe(stockCountLabel(BASE_VERIFIED_STOCKS.length));
  });
  it("rounds down to the nearest 50", () => {
    expect(stockCountLabel(358)).toBe("350+");
    expect(stockCountLabel(400)).toBe("400+");
  });
});
