import { describe, expect, it } from "vitest";
import { PROTOCOL_REALITY_REGISTRY } from "@/components/lending/ProtocolCompareHub";
import { getUnifiedStockLendingComparison } from "@/lib/lending/unified-comparison";

describe("Protocol Comparison Hub & Real DeFi Verification", () => {
  it("verifies reality registry audits all 8 major Base protocols", () => {
    expect(PROTOCOL_REALITY_REGISTRY.length).toBe(8);

    const protocolIds = PROTOCOL_REALITY_REGISTRY.map((p) => p.id);
    expect(protocolIds).toContain("beefy");
    expect(protocolIds).toContain("aerodrome");
    expect(protocolIds).toContain("morpho");
    expect(protocolIds).toContain("moonwell");
    expect(protocolIds).toContain("aave");
    expect(protocolIds).toContain("euler");
    expect(protocolIds).toContain("pendle");
    expect(protocolIds).toContain("superform");
  });

  it("verifies Beefy Finance is confirmed live for tokenized stocks auto-compounding", () => {
    const beefy = PROTOCOL_REALITY_REGISTRY.find((p) => p.id === "beefy")!;
    expect(beefy).toBeDefined();
    expect(beefy.status).toBe("live_stocks");
    expect(beefy.stocksSupported).toBe(true);
    expect(beefy.category).toBe("Auto-Compounder");
    expect(beefy.appUrl).toBe("https://app.beefy.com");
  });

  it("verifies Aerodrome Finance is confirmed live for DEX LP gauge staking", () => {
    const aero = PROTOCOL_REALITY_REGISTRY.find((p) => p.id === "aerodrome")!;
    expect(aero).toBeDefined();
    expect(aero.status).toBe("live_stocks");
    expect(aero.stocksSupported).toBe(true);
    expect(aero.category).toBe("DEX & Gauges");
  });

  it("verifies pooled protocols (Aave V3, Moonwell) are transparently categorized as crypto-only for lending", () => {
    const aave = PROTOCOL_REALITY_REGISTRY.find((p) => p.id === "aave")!;
    const moonwell = PROTOCOL_REALITY_REGISTRY.find((p) => p.id === "moonwell")!;

    expect(aave.status).toBe("crypto_only");
    expect(aave.stocksSupported).toBe(false);

    expect(moonwell.status).toBe("crypto_only");
    expect(moonwell.stocksSupported).toBe(false);
  });

  it("verifies unified comparison always includes Beefy and Aerodrome for any stock", async () => {
    const comp = await getUnifiedStockLendingComparison("NVDAc");
    const protocols = comp.options.map((o) => o.protocol);

    expect(protocols).toContain("beefy");
    expect(protocols).toContain("aerodrome");
    expect(protocols).toContain("morpho_blue");

    const beefyOpt = comp.options.find((o) => o.protocol === "beefy")!;
    expect(beefyOpt.type).toBe("vault");
    expect(beefyOpt.supplyApy).toBeGreaterThan(0);
    expect(beefyOpt.sourceLink).toContain("beefy.com");

    const aeroOpt = comp.options.find((o) => o.protocol === "aerodrome")!;
    expect(aeroOpt.type).toBe("strategy");
    expect(aeroOpt.supplyApy).toBeGreaterThan(0);
  });
});
