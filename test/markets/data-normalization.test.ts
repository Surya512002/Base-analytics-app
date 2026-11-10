import { describe, it, expect } from "vitest";
import {
  StockMarketItemSchema,
  MarketsOverviewSchema,
  OFFICIAL_TRADE_VENUES,
  formatUsdLarge,
} from "@/lib/markets/types";
import { fetchMarketsOverview, fetchStockMarkets } from "@/lib/markets/markets-service";

describe("Markets Data Normalization & Schema Validation", () => {
  it("validates a compliant StockMarketItem object with Zod schema", () => {
    const validStock = {
      symbol: "NVDAc",
      underlyingTicker: "NVDA",
      name: "Nvidia Corp (Backed)",
      address: "0xb20000000000000000000078ee7ce2fe4908108c",
      decimals: 8,
      price: 135.25,
      change24h: 3.42,
      tradingLiquidity: 4250000,
      priceImpact10k: 0.18,
      usedAsCollateral: 1850000,
      appVolumes: {
        aerodrome: 2500000,
        uniswap: 1750000,
      },
      category: "tech",
      prospectusUrl: "https://backed.fi/prospectus/nvda",
      priceWeek: [
        { date: "Day 1", value: 130 },
        { date: "Day 2", value: 135.25 },
      ],
      status: "active" as const,
      lastUpdated: new Date().toISOString(),
    };

    const parsed = StockMarketItemSchema.parse(validStock);
    expect(parsed.symbol).toBe("NVDAc");
    expect(parsed.underlyingTicker).toBe("NVDA");
    expect(parsed.decimals).toBe(8);
    expect(parsed.price).toBe(135.25);
    expect(parsed.appVolumes.aerodrome).toBe(2500000);
  });

  it("applies robust schema defaults for optional and omitted fields", () => {
    const minimalStock = {
      symbol: "AMZNc",
      underlyingTicker: "AMZN",
      name: "Amazon.com Inc (Backed)",
      address: "0xb2000000000000000000003058864a7c06eb61cf",
      price: 195.5,
      change24h: -1.2,
      tradingLiquidity: 1200000,
      priceImpact10k: null,
      usedAsCollateral: null,
      lastUpdated: new Date().toISOString(),
    };

    const parsed = StockMarketItemSchema.parse(minimalStock);
    expect(parsed.decimals).toBe(8);
    expect(parsed.category).toBe("tech");
    expect(parsed.status).toBe("active");
    expect(parsed.priceWeek).toEqual([]);
    expect(parsed.appVolumes).toEqual({});
  });

  it("rejects invalid Ethereum contract address formats", () => {
    const badAddress = {
      symbol: "BAD",
      underlyingTicker: "BAD",
      name: "Bad Stock",
      address: "not-a-valid-hex-address",
      price: 10,
      change24h: 0,
      tradingLiquidity: 100,
      priceImpact10k: null,
      usedAsCollateral: null,
      lastUpdated: new Date().toISOString(),
    };

    expect(() => StockMarketItemSchema.parse(badAddress)).toThrow();
  });

  it("validates MarketsOverview schema with activity series", () => {
    const seriesItem = {
      label: "Volume vs Supplied",
      points: [
        { date: "1M", value: 5000000 },
        { date: "Now", value: 8450000 },
      ],
      ranges: [
        { label: "1M" as const, days: 30 },
        { label: "3M" as const, days: 90 },
        { label: "All" as const, days: null },
      ],
    };

    const overviewData = {
      volume24h: 8450000,
      totalSupplied: 24500000,
      totalBorrowed: 12800000,
      series: [seriesItem],
      dataAsOf: new Date().toISOString(),
      isStale: false,
    };

    const parsed = MarketsOverviewSchema.parse(overviewData);
    expect(parsed.volume24h).toBe(8450000);
    expect(parsed.totalSupplied).toBe(24500000);
    expect(parsed.series).toHaveLength(1);
    expect(parsed.series[0].ranges).toHaveLength(3);
  });

  it("verifies official trade venues directory integrity", () => {
    expect(OFFICIAL_TRADE_VENUES.length).toBeGreaterThanOrEqual(4);
    const names = OFFICIAL_TRADE_VENUES.map((v) => v.name);
    expect(names).toContain("Aerodrome Finance");
    expect(names).toContain("Coinbase Wallet");
    expect(names).toContain("Matcha (0x)");
    expect(names).toContain("1inch Network");

    OFFICIAL_TRADE_VENUES.forEach((venue) => {
      expect(venue.url).toMatch(/^https:\/\//);
      expect(venue.description.length).toBeGreaterThan(5);
    });
  });

  it("formats large USD currency figures accurately", () => {
    expect(formatUsdLarge(1_500_000_000)).toBe("$1.50B");
    expect(formatUsdLarge(25_400_000)).toBe("$25.40M");
    expect(formatUsdLarge(450_000)).toBe("$450.0K");
    expect(formatUsdLarge(85)).toBe("$85.00");
    expect(formatUsdLarge(null)).toBe("—");
  });

  it("fetches stock markets list with valid addresses and sorting", async () => {
    const items = await fetchStockMarkets();
    expect(items.length).toBeGreaterThanOrEqual(4);
    items.forEach((item) => {
      expect(item.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(item.price).toBeGreaterThan(0);
    });

    if (items.length > 1) {
      expect(items[0].tradingLiquidity).toBeGreaterThanOrEqual(items[1].tradingLiquidity);
    }
  }, 15000);

  it("fetches markets overview payload safely with series", async () => {
    const overview = await fetchMarketsOverview();
    expect(overview.volume24h).toBeGreaterThanOrEqual(0);
    expect(overview.totalSupplied).toBeGreaterThanOrEqual(0);
    expect(overview.series.length).toBeGreaterThan(0);
    expect(overview.series[0].points.length).toBeGreaterThan(0);
  }, 15000);
});
