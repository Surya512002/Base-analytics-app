import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/stocks/coinbase-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stocks/coinbase-api")>();
  return {
    ...actual,
    fetchAllCoinbaseTokenizedStocks: vi.fn(async () => [
      {
        symbol: "NVDAc",
        underlyingTicker: "NVDA",
        name: "NVIDIA Corporation",
        address: "0x1234567890123456789012345678901234567890",
        nav: 125.5,
        change24h: 2.5,
        volume24hUsd: 50000000,
        mcapUsd: 3000000000,
        decimals: 8,
        category: "tech",
      },
      {
        symbol: "TSLAc",
        underlyingTicker: "TSLA",
        name: "Tesla Inc",
        address: "0x2234567890123456789012345678901234567890",
        nav: 210.0,
        change24h: -1.2,
        volume24hUsd: 30000000,
        mcapUsd: 700000000,
        decimals: 8,
        category: "tech",
      },
    ]),
  };
});

describe("TokenLaunchForm Stock Markets API Integration", () => {
  it("verifies /api/stocks endpoint is defined and provides stock prices structure", async () => {
    // Import stocks API handler directly
    const { GET } = await import("@/app/api/stocks/route");
    const req = new Request("http://localhost:3000/api/stocks");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.stocks).toBeDefined();
    expect(Array.isArray(data.stocks)).toBe(true);
    expect(data.stocks.length).toBeGreaterThan(0);

    // Verify each stock entry has symbol and valid numeric NAV
    const sample = data.stocks[0];
    expect(sample.symbol).toBeDefined();
    expect(typeof sample.nav).toBe("number");
    expect(sample.nav).toBeGreaterThan(0);
  }, 30_000);
});
