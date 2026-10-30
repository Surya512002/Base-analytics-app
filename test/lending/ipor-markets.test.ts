import { describe, expect, it } from "vitest";
import { BASE_STOCKS } from "@/lib/stocks/base-stocks";
import { getBaselineVerifiedMarkets } from "@/lib/lending/discovery/baseline";
import { VERIFIED_IPOR_STOCK_VAULTS, AAVE_EQUITIES_SUPPORTED_STOCKS } from "@/lib/lending/unified-comparison";

describe("IPOR Fusion Markets & Canonical Stocks Verification", () => {
  it("verifies BASE_STOCKS has exactly 8 canonical stocks", () => {
    expect(BASE_STOCKS.length).toBe(8);
    const symbols = BASE_STOCKS.map((s) => s.symbol);
    expect(symbols).toEqual([
      "NVDAc",
      "AAPLc",
      "MSFTc",
      "TSLAc",
      "GOOGLc",
      "AMZNc",
      "METAc",
      "COINc",
    ]);
  });

  it("verifies only the 4 canonical stocks have IPOR Fusion vaults", () => {
    const baseline = getBaselineVerifiedMarkets();
    const iporMarkets = baseline.filter((m) => m.protocol === "ipor");
    expect(iporMarkets.length).toBe(4);

    const iporSymbols = iporMarkets.map((m) => m.supplyAsset.symbol);
    expect(iporSymbols).toContain("GOOGLc");
    expect(iporSymbols).toContain("NVDAc");
    expect(iporSymbols).toContain("AAPLc");
    expect(iporSymbols).toContain("METAc");
    expect(iporSymbols).not.toContain("MSFTc");
    expect(iporSymbols).not.toContain("TSLAc");
    expect(iporSymbols).not.toContain("AMZNc");
    expect(iporSymbols).not.toContain("COINc");
  });

  it("verifies stockRows protocol matching gives exactly 4 stocks with IPOR Fusion", () => {
    const discoveredMarkets = getBaselineVerifiedMarkets();

    const stockRows = BASE_STOCKS.map((stk) => {
      const matchingMarkets = discoveredMarkets.filter(
        (m) =>
          m.collateralAsset?.address.toLowerCase() === stk.address.toLowerCase() ||
          m.supplyAsset.address.toLowerCase() === stk.address.toLowerCase() ||
          m.collateralAsset?.symbol.toLowerCase() === stk.symbol.toLowerCase() ||
          m.supplyAsset.symbol.toLowerCase() === stk.symbol.toLowerCase() ||
          (stk.symbol === "GOOGLc" &&
            (m.supplyAsset.symbol.toLowerCase() === "googc" ||
              m.collateralAsset?.symbol.toLowerCase() === "googc"))
      );

      const hasLendingMarket =
        matchingMarkets.length > 0 ||
        AAVE_EQUITIES_SUPPORTED_STOCKS.has(stk.symbol) ||
        Boolean(VERIFIED_IPOR_STOCK_VAULTS[stk.symbol]);
      const protocolSet = new Set(matchingMarkets.map((m) => m.protocolLabel));
      if (AAVE_EQUITIES_SUPPORTED_STOCKS.has(stk.symbol)) protocolSet.add("Aave Pro");
      if (
        VERIFIED_IPOR_STOCK_VAULTS[stk.symbol] ||
        (stk.symbol === "GOOGLc" && VERIFIED_IPOR_STOCK_VAULTS["GOOGc"])
      )
        protocolSet.add("IPOR Fusion");
      const listedProtocols = Array.from(protocolSet);

      return {
        symbol: stk.symbol,
        listedProtocols,
        hasLendingMarket,
      };
    });

    const iporFiltered = stockRows.filter((r) =>
      r.listedProtocols.some((p) => p.toLowerCase().includes("ipor"))
    );

    expect(iporFiltered.length).toBe(4);
    const iporStockSymbols = iporFiltered.map((r) => r.symbol);
    expect(iporStockSymbols).toContain("NVDAc");
    expect(iporStockSymbols).toContain("AAPLc");
    expect(iporStockSymbols).toContain("GOOGLc");
    expect(iporStockSymbols).toContain("METAc");
    expect(iporStockSymbols).not.toContain("MSFTc");
  });
});
