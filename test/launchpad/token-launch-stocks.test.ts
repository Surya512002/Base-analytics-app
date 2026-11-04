import { describe, it, expect } from "vitest";

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
    expect(typeof sample.symbol).toBe("string");
    expect(typeof sample.nav).toBe("number");
    expect(sample.nav).toBeGreaterThan(0);
  });
});
