import { describe, expect, it } from "vitest";
import {
  VERIFIED_BEEFY_STOCK_VAULTS,
  VERIFIED_BEEFY_STOCK_DETAILS,
  VERIFIED_AERODROME_STOCK_POOLS,
  getUnifiedStockLendingComparison,
} from "@/lib/lending/unified-comparison";
import { BASE_LENDING_MARKETS } from "@/lib/lending/markets";
import { BASE_STOCKS } from "@/lib/stocks/base-stocks";
import { isAddress } from "viem";

describe("Beefy Finance Added Tokenized Stocks", () => {
  const newStockSymbols = [
    "INTCc",
    "AMDc",
    "SKHYc",
    "ORCLc",
    "NFLXc",
    "HIMSc",
    "LLYc",
    "CBRSc",
    "PYPLc",
    "RBLXc",
  ];

  it("verifies all newly added stocks are registered in VERIFIED_BEEFY_STOCK_VAULTS with valid checksums", () => {
    for (const sym of newStockSymbols) {
      const vault = VERIFIED_BEEFY_STOCK_VAULTS[sym];
      expect(vault, `Missing Beefy vault for ${sym}`).toBeDefined();
      expect(isAddress(vault), `Invalid checksum for ${sym}: ${vault}`).toBe(true);
    }
  });

  it("verifies VERIFIED_BEEFY_STOCK_DETAILS contains proper vault metadata and no fake APYs", () => {
    for (const sym of newStockSymbols) {
      const details = VERIFIED_BEEFY_STOCK_DETAILS[sym];
      expect(details, `Missing details for ${sym}`).toBeDefined();
      expect(details.vaultId).toMatch(/^(aero|aerodrome)-cow-base/);
      expect(isAddress(details.wantTokenAddress)).toBe(true);
      expect(details.apy).toBe(0); // must be 0 initially to allow pure on-chain/API live sync
    }
  });

  it("verifies VERIFIED_AERODROME_STOCK_POOLS has matching pool addresses for new stocks", () => {
    for (const sym of newStockSymbols) {
      const pool = VERIFIED_AERODROME_STOCK_POOLS[sym];
      expect(pool, `Missing Aerodrome pool for ${sym}`).toBeDefined();
      expect(isAddress(pool.poolAddress)).toBe(true);
      expect(pool.poolAddress).toBe(VERIFIED_BEEFY_STOCK_DETAILS[sym].wantTokenAddress);
    }
  });

  it("verifies BASE_LENDING_MARKETS includes Beefy Auto-Compounders for active new stocks", () => {
    const activeSymbols = ["INTCc", "AMDc", "SKHYc", "ORCLc", "NFLXc", "HIMSc", "LLYc", "CBRSc"];
    for (const sym of activeSymbols) {
      const beefyMarket = BASE_LENDING_MARKETS.find(
        (m) => m.protocol === "beefy" && m.collateralAsset?.symbol === sym
      );
      expect(beefyMarket, `Missing Beefy market in BASE_LENDING_MARKETS for ${sym}`).toBeDefined();
      expect(beefyMarket?.contractType).toBe("beefy_vault");
      expect(beefyMarket?.contractAddress).toBe(VERIFIED_BEEFY_STOCK_VAULTS[sym]);
    }
  });

  it("verifies getUnifiedStockLendingComparison includes Beefy Finance option for INTCc", async () => {
    const comp = await getUnifiedStockLendingComparison("INTCc");
    expect(comp.stockSymbol).toBe("INTCc");
    const beefyOpt = comp.options.find((o) => o.protocol === "beefy");
    expect(beefyOpt).toBeDefined();
    expect(beefyOpt?.protocolName).toBe("Beefy Finance");
    expect(beefyOpt?.contractAddress).toBe("0x2Cb70836DD8f9A350Ff2F25805D4B213BF553468");
    expect(beefyOpt?.sourceLink).toContain("aero-cow-base-usdc-intcc-vault");
  });

  it("verifies all 10 newly added stocks are present in BASE_STOCKS", () => {
    const baseStockSymbols = BASE_STOCKS.map((s) => s.symbol);
    for (const sym of newStockSymbols) {
      expect(baseStockSymbols).toContain(sym);
    }
  });
});
