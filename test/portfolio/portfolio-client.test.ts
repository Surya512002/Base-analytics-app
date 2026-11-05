import { describe, it, expect, vi } from "vitest";
import { getAddress } from "viem";
import { getWalletPortfolio } from "@/lib/portfolio/portfolio-service";

vi.mock("@/lib/portfolio/indexer", () => ({
  discoverWalletBalances: vi.fn(async (address: string, customAddrs: string[] = []) => {
    if (address.toLowerCase() === "0x70997970c51812dc3a010c7d01b50e0d17dc79c8") {
      if (customAddrs.length > 0) {
        return {
          nativeEthBigInt: BigInt(0),
          balances: customAddrs.map((addr) => ({
            address: addr,
            symbol: "UNLISTED",
            name: "Unlisted Token",
            decimals: 18,
            balanceBigInt: BigInt("1000000000000000000"),
            balanceRaw: "1000000000000000000",
            balanceFormatted: "1.0",
            balanceNumber: 1.0,
          })),
        };
      }
      return { nativeEthBigInt: BigInt(0), balances: [] };
    }
    // funded address mock data
    return {
      nativeEthBigInt: BigInt("1500000000000000000"), // 1.5 ETH
      balances: [
        {
          address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
          balanceBigInt: BigInt("250000000"), // 250 USDC
          balanceRaw: "250000000",
          balanceFormatted: "250.0",
          balanceNumber: 250.0,
        },
      ],
    };
  }),
}));

vi.mock("@/lib/portfolio/pricing", () => ({
  batchPriceTokens: vi.fn(async (_addresses: Array<string | null>) => {
    const map = new Map();
    map.set("eth", { priceUsd: 2500, priceSource: "dexscreener" });
    map.set("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", { priceUsd: 1.0, priceSource: "dexscreener" });
    return map;
  }),
}));

describe("Portfolio Client State & Invariants (Hermetic)", () => {
  const fundedAddress = getAddress("0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F");
  const emptyAddress = getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");

  it("populates totalUsd and tokens matching expected values for connected wallet", async () => {
    const portfolio = await getWalletPortfolio(fundedAddress, [], false);

    expect(portfolio.address).toBe(fundedAddress);
    expect(portfolio.chainId).toBe(8453);
    expect(portfolio.tokens.length).toBeGreaterThanOrEqual(1);

    // Sum of priced tokens matches totalUsd
    let computedPricedTotal = 0;
    for (const t of portfolio.tokens) {
      if (t.priceUsd != null && !t.isSpam) {
        computedPricedTotal += t.usdValue;
      }
    }
    expect(portfolio.totalUsd).toBeCloseTo(computedPricedTotal, 1);
  });

  it("presents tokens without a price feed as 'No price' (priceUsd === null)", async () => {
    // Add custom unlisted token contract
    const unlisted = getAddress("0x0000000000000000000000000000000000000001");
    const portfolio = await getWalletPortfolio(emptyAddress, [unlisted], false);

    const token = portfolio.tokens.find((t) => t.address?.toLowerCase() === unlisted.toLowerCase());
    expect(token).toBeDefined();
    if (token) {
      expect(token.priceUsd).toBeNull();
      expect(token.priceSource).toBe("none");
      expect(token.usdValue).toBe(0);
    }
  });

  it("returns zero counts and empty tokens for unfunded / disconnected wallet", async () => {
    const portfolio = await getWalletPortfolio(emptyAddress, [], false);

    expect(portfolio.address).toBe(emptyAddress);
    expect(portfolio.tokens.length).toBe(0);
    expect(portfolio.totalUsd).toBe(0);
    expect(portfolio.pricedCount).toBe(0);
    expect(portfolio.unpricedCount).toBe(0);
  });

  it("ensures token count strictly matches the tokens list length", async () => {
    const portfolio = await getWalletPortfolio(fundedAddress, [], false);
    expect(portfolio.totalCount).toBe(portfolio.tokens.length);
  });

  it("verifies holdings structure has consistent decimals, symbols, and non-negative numbers", async () => {
    const portfolio = await getWalletPortfolio(fundedAddress, [], false);
    for (const t of portfolio.tokens) {
      expect(typeof t.symbol).toBe("string");
      expect(t.symbol.length).toBeGreaterThan(0);
      expect(typeof t.decimals).toBe("number");
      expect(t.decimals).toBeGreaterThanOrEqual(0);
      expect(t.balanceNumber).toBeGreaterThanOrEqual(0);
      if (t.priceUsd !== null) {
        expect(t.priceUsd).toBeGreaterThanOrEqual(0);
        expect(t.usdValue).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
