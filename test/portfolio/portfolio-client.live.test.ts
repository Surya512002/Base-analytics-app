import { describe, it, expect } from "vitest";
import { getAddress } from "viem";
import { getWalletPortfolio } from "@/lib/portfolio/portfolio-service";

describe("Live Network: Portfolio Client State & Invariants", () => {
  const fundedAddress = getAddress("0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F");
  const emptyAddress = getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");

  it("populates totalUsd and tokens matching expected values for connected wallet", async () => {
    const portfolio = await getWalletPortfolio(fundedAddress, [], false);

    expect(portfolio.address).toBe(fundedAddress);
    expect(portfolio.chainId).toBe(8453);
    expect(portfolio.tokens.length).toBeGreaterThanOrEqual(1);

    let computedPricedTotal = 0;
    for (const t of portfolio.tokens) {
      if (t.priceUsd != null && !t.isSpam) {
        computedPricedTotal += t.usdValue;
      }
    }
    expect(portfolio.totalUsd).toBeCloseTo(computedPricedTotal, 1);
  }, 30000);

  it("returns zero counts and empty tokens for unfunded / disconnected wallet", async () => {
    const portfolio = await getWalletPortfolio(emptyAddress, [], false);

    expect(portfolio.address).toBe(emptyAddress);
    expect(portfolio.tokens.length).toBe(0);
    expect(portfolio.totalUsd).toBe(0);
    expect(portfolio.pricedCount).toBe(0);
    expect(portfolio.unpricedCount).toBe(0);
  }, 30000);
});
