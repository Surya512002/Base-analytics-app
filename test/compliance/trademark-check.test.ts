import { describe, expect, it } from "vitest";
import { checkTrademarkCollision } from "@/lib/launchpad/trademark-check";

describe("Launchpad Trademark & Impersonation Collision Check Suite", () => {
  it("flags exact ticker collisions against tokenized stocks registry", () => {
    const resultAapl = checkTrademarkCollision("Apple Fan Club", "AAPL");
    expect(resultAapl.hasCollision).toBe(true);
    expect(resultAapl.matchedTicker).toBe("AAPL");
    expect(resultAapl.reason).toContain("AAPL");

    const resultTsla = checkTrademarkCollision("Tesla Bulls", "TSLA");
    expect(resultTsla.hasCollision).toBe(true);
    expect(resultTsla.matchedTicker).toBe("TSLA");

    const resultMstr = checkTrademarkCollision("MicroStrategy Hodl", "MSTR");
    expect(resultMstr.hasCollision).toBe(true);
    expect(resultMstr.matchedTicker).toBe("MSTR");
  });

  it("flags company name collisions against tokenized stocks registry", () => {
    const resultNvidia = checkTrademarkCollision("NVIDIA Artificial Intelligence", "NVDAI");
    expect(resultNvidia.hasCollision).toBe(true);
    expect(resultNvidia.matchedCompany).toMatch(/NVIDIA/i);

    const resultMicrosoft = checkTrademarkCollision("Microsoft Azure Coin", "MSFTC");
    expect(resultMicrosoft.hasCollision).toBe(true);
    expect(resultMicrosoft.matchedCompany).toMatch(/Microsoft/i);
  });

  it("passes safe, non-colliding token names and tickers", () => {
    const safeTokens = [
      { name: "Based Doge", symbol: "BDOGE" },
      { name: "Blue Hour Protocol", symbol: "BHOUR" },
      { name: "Crypto Punks Fan Token", symbol: "PUNKS" },
      { name: "Yield Farmer", symbol: "FARM" },
      { name: "Aerodrome Community", symbol: "AERO" },
    ];

    for (const t of safeTokens) {
      const result = checkTrademarkCollision(t.name, t.symbol);
      expect(result.hasCollision).toBe(false);
      expect(result.matchedCompany).toBeUndefined();
      expect(result.matchedTicker).toBeUndefined();
    }
  });

  it("handles empty or partial inputs gracefully", () => {
    const emptyResult = checkTrademarkCollision("", "");
    expect(emptyResult.hasCollision).toBe(false);

    const nameOnly = checkTrademarkCollision("Apple", "");
    expect(nameOnly.hasCollision).toBe(true);

    const symbolOnly = checkTrademarkCollision("", "NVDA");
    expect(symbolOnly.hasCollision).toBe(true);
  });
});
