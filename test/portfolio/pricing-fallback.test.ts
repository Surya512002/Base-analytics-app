import { describe, it, expect } from "vitest";
import { batchPriceTokens } from "@/lib/portfolio/pricing";

describe("Pricing Fallback Engine", () => {
  it("prices native ETH using Chainlink or DefiLlama fallback", async () => {
    const priceMap = await batchPriceTokens([null]);
    const eth = priceMap.get("eth");
    expect(eth).toBeDefined();
    expect(eth?.priceUsd).toBeGreaterThan(0);
    expect(["chainlink", "defillama"]).toContain(eth?.priceSource);
  });

  it("prices stablecoins (USDC) with pegged price of 1.0", async () => {
    const usdcAddr = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
    const priceMap = await batchPriceTokens([usdcAddr]);
    const usdc = priceMap.get(usdcAddr.toLowerCase());
    expect(usdc).toBeDefined();
    expect(usdc?.priceUsd).toBe(1.0);
    expect(usdc?.priceSource).toBe("pegged");
  });

  it("handles unpriced tokens by setting priceSource to none without throwing", async () => {
    // Random non-existent contract address
    const unknownAddr = "0x000000000000000000000000000000000000dead" as const;
    const priceMap = await batchPriceTokens([unknownAddr]);
    const unknown = priceMap.get(unknownAddr.toLowerCase());
    expect(unknown).toBeDefined();
    expect(unknown?.priceUsd).toBeNull();
    expect(unknown?.priceSource).toBe("none");
  });
});
