import { describe, expect, it } from "vitest";
import { getTokenizedStockBySymbol as lookup } from "@/lib/stocks/tokenized-stocks-registry";

/** Look-alike tickers must never resolve to each other (e.g. Boeing "BAc" vs Bank of America "BACc"). */
describe("stock symbol lookup", () => {
  it("resolves exact symbols to themselves", () => {
    expect(lookup("BAc")?.name).toMatch(/Boeing/);
    expect(lookup("BACc")?.name).toMatch(/Bank of America/);
    expect(lookup("Sc")?.name).toMatch(/SentinelOne/);
    expect(lookup("Vc")?.name).toMatch(/Visa/);
    expect(lookup("Fc")?.name).toMatch(/Ford/);
  });

  it("resolves plain tickers to the right company", () => {
    expect(lookup("BA")?.symbol).toBe("BAc");
    expect(lookup("BAC")?.symbol).toBe("BACc");
    expect(lookup("NVDA")?.symbol).toBe("NVDAc");
    expect(lookup("GOOG")?.symbol).toBe("GOOGLc");
    expect(lookup("V")?.symbol).toBe("Vc");
  });

  it("still accepts other casings and legacy aliases", () => {
    expect(lookup("nvdac")?.symbol).toBe("NVDAc");
    expect(lookup("GOOGc")?.symbol).toBe("GOOGLc");
    expect(lookup("dAMD")?.symbol).toBe("dAMD");
    expect(lookup("")).toBeNull();
    expect(lookup("NOTAREALTICKERc")).toBeNull();
  });
});
