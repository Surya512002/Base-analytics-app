import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/markets/lending/route";
import { getUnifiedStockLendingComparison } from "@/lib/lending/unified-comparison";
import { beefyAdapter } from "@/lib/lending/discovery/adapters/beefy";
import { aerodromeAdapter } from "@/lib/lending/discovery/adapters/aerodrome";

describe("Lend & Stake Live APY/APR Sync Audit", () => {
  it("verifies /api/markets/lending GET updates live Beefy and Aerodrome rates", async () => {
    const req = new Request("http://localhost:3000/api/markets/lending");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.markets.length).toBeGreaterThan(0);

    // NVDA Beefy
    const beefyNvda = data.markets.find((m: any) => m.id === "stock-lend-nvda");
    expect(beefyNvda).toBeDefined();
    expect(beefyNvda.supplyApy).toBeGreaterThan(0);
    expect(beefyNvda.supplyApy).toBeLessThan(30); // Live Beefy NVDA is ~5.91%, definitely not 28.5%

    // MSFT Beefy
    const beefyMsft = data.markets.find((m: any) => m.id === "beefy-msftc-usdc");
    expect(beefyMsft).toBeDefined();
    expect(beefyMsft.supplyApy).toBeGreaterThan(0);
    expect(beefyMsft.supplyApy).toBeLessThan(50); // Live Beefy MSFT is ~4.37%, definitely not 293.17%!

    // TSLA Beefy
    const beefyTsla = data.markets.find((m: any) => m.id === "beefy-tslac-usdc");
    expect(beefyTsla).toBeDefined();
    expect(beefyTsla.supplyApy).toBeGreaterThan(0);
    expect(beefyTsla.supplyApy).toBeLessThan(50); // Live Beefy TSLA is ~6.40%, definitely not 54.45%!

    // NVDA Aerodrome
    const aeroNvda = data.markets.find((m: any) => m.id === "aero-nvdac-usdc");
    expect(aeroNvda).toBeDefined();
    expect(aeroNvda.supplyApy).toBeGreaterThan(0);
    expect(aeroNvda.tvlUsd).toBeGreaterThan(10000);
  });

  it("verifies getUnifiedStockLendingComparison returns live rates matching Beefy and Aerodrome", async () => {
    const comp = await getUnifiedStockLendingComparison("MSFTc", undefined, true);
    expect(comp.options.length).toBeGreaterThan(0);

    const beefyOpt = comp.options.find((o) => o.protocol === "beefy");
    expect(beefyOpt).toBeDefined();
    expect(beefyOpt?.supplyApy).toBeLessThan(50); // Live is ~4.37%, not 293.17%!
    expect(beefyOpt?.supplyApy).toBeGreaterThan(0);

    const aeroOpt = comp.options.find((o) => o.protocol === "aerodrome");
    expect(aeroOpt).toBeDefined();
    expect(aeroOpt?.supplyApy).toBeLessThan(50); // Live is ~2.12%, not 285%!
    expect(aeroOpt?.supplyApy).toBeGreaterThan(0);
  });

  it("verifies beefyAdapter discovers active stock vaults with live APYs", async () => {
    const markets = await beefyAdapter.discoverMarkets(8453);
    expect(markets.length).toBeGreaterThan(0);
    const msft = markets.find((m) => m.collateralAsset?.symbol === "MSFTc");
    expect(msft).toBeDefined();
    expect(msft?.supplyApy).toBeLessThan(50); // ~4.37%
    expect(msft?.status).toBe("active");
  });

  it("verifies aerodromeAdapter discovers active stock pools with live APYs", async () => {
    const markets = await aerodromeAdapter.discoverMarkets(8453);
    expect(markets.length).toBeGreaterThan(0);
    const nvda = markets.find((m) => m.collateralAsset?.symbol === "NVDAc");
    expect(nvda).toBeDefined();
    expect(nvda?.supplyApy).toBeGreaterThan(0);
  });
});
