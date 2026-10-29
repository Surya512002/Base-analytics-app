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

  it("verifies unified comparison includes verified protocols for supported stock (NVDAc)", async () => {
    const comp = await getUnifiedStockLendingComparison("NVDAc");
    const protocols = comp.options.map((o) => o.protocol);

    expect(protocols).toContain("beefy");
    expect(protocols).toContain("aerodrome");
    expect(protocols).toContain("morpho_blue");

    const beefyOpt = comp.options.find((o) => o.protocol === "beefy")!;
    expect(beefyOpt.type).toBe("vault");
    expect(beefyOpt.supplyApy).toBeGreaterThan(0);
    expect(beefyOpt.sourceLink).toContain("beefy.com");
    expect(beefyOpt.contractAddress).toBe("0xD317fDf7e7E3BA9dc9A73CAe2E54732646866025");

    const aeroOpt = comp.options.find((o) => o.protocol === "aerodrome")!;
    expect(aeroOpt.type).toBe("strategy");
    expect(aeroOpt.supplyApy).toBeGreaterThan(0);
    expect(aeroOpt.contractAddress).toBe("0xA282064541Bb45Caa046fB9f21a240671aBB7f46");

    const morphoOpt = comp.options.find((o) => o.protocol === "morpho_blue")!;
    expect(morphoOpt.borrowApr).toBe(3.2);
    expect(morphoOpt.contractAddress).toBe("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb");
  });

  it("verifies unwhitelisted stocks with zero protocol pools return 0 options without mock fallbacks", async () => {
    const comp = await getUnifiedStockLendingComparison("COINc", undefined, true);
    // COINc currently has no active Beefy vault, no Aerodrome CoW pool, and no Morpho Blue market on Base
    expect(comp.options.length).toBe(0);
    expect(comp.bestSupplyOption).toBeNull();
    expect(comp.bestBorrowOption).toBeNull();
    expect(comp.highestLiquidityOption).toBeNull();
  });

  it("verifies all returned contract addresses are non-empty and start with 0x", async () => {
    const comp = await getUnifiedStockLendingComparison("MSFTc");
    expect(comp.options.length).toBeGreaterThanOrEqual(1);

    for (const opt of comp.options) {
      expect(opt.contractAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(opt.contractAddress).not.toBe("0x0000000000000000000000000000000000000000");
    }
  });
});
