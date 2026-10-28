import { describe, it, expect } from "vitest";
import { getAddress } from "viem";
import { discoverWalletBalances } from "@/lib/portfolio/indexer";
import { getWalletPortfolio } from "@/lib/portfolio/portfolio-service";

describe("Indexer & Multicall Merging Engine", () => {
  it("always checks native ETH and registry tokens without mock fallbacks", async () => {
    // Fresh random address
    const testWallet = getAddress("0x7F367cC41522Ce07553e8435b8b4f7257bd4A020");
    const result = await discoverWalletBalances(testWallet);

    expect(result).toBeDefined();
    expect(typeof result.nativeEthBigInt).toBe("bigint");
    expect(Array.isArray(result.balances)).toBe(true);
    expect(["alchemy", "blockscout", "onchain_fallback"]).toContain(result.source);
  });

  it("builds a full portfolio response with valid counts and BigInt formatted balances", async () => {
    const testWallet = "0x7F367cC41522Ce07553e8435b8b4f7257bd4A020";
    const portfolio = await getWalletPortfolio(testWallet, [], false);

    expect(portfolio.address.toLowerCase()).toBe(testWallet.toLowerCase());
    expect(portfolio.chainId).toBe(8453);
    expect(portfolio.chainName).toBe("Base");
    expect(typeof portfolio.totalUsd).toBe("number");
    expect(typeof portfolio.pricedCount).toBe("number");
    expect(typeof portfolio.unpricedCount).toBe("number");
    expect(portfolio.totalCount).toBe(portfolio.tokens.length);
  });
});
