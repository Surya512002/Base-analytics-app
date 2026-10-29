import { describe, expect, it } from "vitest";
import { getAddress, isAddress } from "viem";
import {
  TOKENIZED_STOCKS_REGISTRY,
  getActiveTokenizedStocks,
  getTokenizedStockByAddress,
  getTokenizedStockBySymbol,
  getStockCategoryCounts,
  isNewStock,
  type TokenizedStockEntry,
} from "@/lib/stocks/tokenized-stocks-registry";
import { BASE_STOCKS, getBaseStockByAddress } from "@/lib/stocks/base-stocks";
import { BASE_LENDING_MARKETS } from "@/lib/lending/markets";

describe("Single Source of Truth Tokenized Stock Registry (Base Mainnet)", () => {
  it("verifies every stock entry has a valid, strictly EIP-55 checksummed address", () => {
    expect(TOKENIZED_STOCKS_REGISTRY.length).toBeGreaterThanOrEqual(32);

    for (const entry of TOKENIZED_STOCKS_REGISTRY) {
      expect(isAddress(entry.address)).toBe(true);
      // Strictly fails if not EIP-55 checksummed
      expect(entry.address).toBe(getAddress(entry.address));

      if (entry.priceFeed.address) {
        expect(isAddress(entry.priceFeed.address)).toBe(true);
        expect(entry.priceFeed.address).toBe(getAddress(entry.priceFeed.address));
      }
    }
  });

  it("verifies all required metadata fields are properly populated", () => {
    const validCategories = [
      "Tech",
      "Finance",
      "Healthcare",
      "Consumer",
      "Energy",
      "Crypto-related",
      "ETF/Index",
      "Other",
    ];

    for (const entry of TOKENIZED_STOCKS_REGISTRY) {
      expect(entry.symbol).toBeTruthy();
      expect(typeof entry.symbol).toBe("string");
      expect(entry.name).toBeTruthy();
      expect(entry.underlyingTicker).toBeTruthy();
      expect([8, 18]).toContain(entry.decimals);
      expect(validCategories).toContain(entry.category);
      expect(["active", "paused", "deprecated", "pending"]).toContain(entry.status);
      expect(new Date(entry.addedAt).getTime()).not.toBeNaN();
      expect(entry.restrictions).toBeDefined();
      expect(typeof entry.restrictions.transferRestricted).toBe("boolean");
      expect(typeof entry.restrictions.allowlistOnly).toBe("boolean");
    }
  });

  it("fails if any stock address used in BASE_LENDING_MARKETS is missing from the registry or not checksummed", () => {
    const stockMarkets = BASE_LENDING_MARKETS.filter(
      (m) =>
        (m.category === "stocks_borrow" &&
          m.collateralAsset?.isStock &&
          m.collateralAsset.symbol.endsWith("c")) ||
        (m.category === "stocks_lend" && m.asset.isStock && m.asset.symbol.endsWith("c")) ||
        (m.category === "stocks_stake" && m.collateralAsset?.isStock && m.collateralAsset.symbol.endsWith("c"))
    );

    expect(stockMarkets.length).toBeGreaterThan(0);

    for (const market of stockMarkets) {
      const stockAsset =
        market.category === "stocks_borrow" || market.category === "stocks_stake"
          ? market.collateralAsset
          : market.asset;
      expect(stockAsset).toBeDefined();
      if (!stockAsset) continue;

      const addr = stockAsset.address;
      expect(isAddress(addr)).toBe(true);
      expect(addr).toBe(getAddress(addr));

      const inRegistry = getTokenizedStockByAddress(addr);
      expect(
        inRegistry,
        `Stock address ${addr} (${stockAsset.symbol}) used in market ${market.id} is missing from TOKENIZED_STOCKS_REGISTRY!`
      ).not.toBeNull();
      expect(inRegistry?.status).toBe("active");
    }
  });

  it("fails if any stock in BASE_STOCKS is missing from TOKENIZED_STOCKS_REGISTRY or not checksummed", () => {
    for (const stock of BASE_STOCKS) {
      expect(isAddress(stock.address)).toBe(true);
      expect(stock.address).toBe(getAddress(stock.address));

      const entry = getTokenizedStockByAddress(stock.address);
      expect(
        entry,
        `Stock ${stock.symbol} (${stock.address}) is missing from TOKENIZED_STOCKS_REGISTRY`
      ).toBeDefined();
    }
  });

  it("verifies dynamic category counts match active registry entries without hardcoding", () => {
    const counts = getStockCategoryCounts();
    const active = getActiveTokenizedStocks();

    expect(counts.All).toBe(active.length);
    const sumCategories =
      counts.Tech +
      counts.Finance +
      counts.Healthcare +
      counts.Consumer +
      counts.Energy +
      counts["Crypto-related"] +
      counts["ETF/Index"] +
      counts.Other;

    expect(sumCategories).toBe(active.length);
  });

  it("verifies lookups by address and symbol work case-insensitively", () => {
    const nvda = getTokenizedStockBySymbol("nvdac");
    expect(nvda).toBeDefined();
    expect(nvda?.symbol).toBe("NVDAc");
    expect(nvda?.underlyingTicker).toBe("NVDA");

    const byAddr = getTokenizedStockByAddress(nvda!.address.toLowerCase());
    expect(byAddr?.symbol).toBe("NVDAc");
  });

  it("verifies isNewStock helper returns true only for stocks added within last 7 days", () => {
    const now = new Date("2026-10-22T12:00:00Z").getTime();
    expect(isNewStock("2026-10-20T00:00:00Z", now)).toBe(true);
    expect(isNewStock("2026-10-10T00:00:00Z", now)).toBe(false);
  });
});
