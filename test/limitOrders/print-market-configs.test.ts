import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { formatMarketConfig, DEFAULT_DEPLOYMENT } = require("../../limit-orders/scripts/print-market-configs");

describe("R2: LimitOrderBook 9-Tuple Market Config Parser", () => {
  it("correctly maps all 9 fields without index scrambling", () => {
    // Simulated on-chain tuple returned by ethers.Contract.markets()
    const mockTuple = {
      0: "0x8836DF0Aa5F499B8E53649e6662EBE1C668F767f",
      1: 8, // feedDecimals
      2: 18, // stockDecimals
      3: true, // enabled
      4: 604800, // maxStaleness (7 days)
      5: 500, // maxDeviationBps (5%)
      6: "0xbDa98551b18431bD95fdF21D06cBc37dA9dE943D", // adapter
      7: 1000000000000000000000n, // maxStockIn
      8: 100000000000n, // maxQuoteIn
      feed: "0x8836DF0Aa5F499B8E53649e6662EBE1C668F767f",
      feedDecimals: 8,
      stockDecimals: 18,
      enabled: true,
      maxStaleness: 604800,
      maxDeviationBps: 500,
      adapter: "0xbDa98551b18431bD95fdF21D06cBc37dA9dE943D",
      maxStockIn: 1000000000000000000000n,
      maxQuoteIn: 100000000000n,
    };

    const marketDef = DEFAULT_DEPLOYMENT.markets[0]; // mNVDA
    const quoteDef = DEFAULT_DEPLOYMENT.quoteToken; // mUSDC (6 decimals)
    const mockRound = { answer: 10000000000n }; // $100.00 (8 decimals)

    const result = formatMarketConfig(mockTuple, marketDef, quoteDef, mockRound, 8);

    expect(result.symbol).toBe("mNVDA");
    expect(result.feedDecimals).toBe(8);
    expect(result.stockDecimals).toBe(18);
    expect(result.enabled).toBe(true);
    expect(result.maxStaleness).toBe(604800);
    expect(result.maxDeviationBps).toBe(500);
    expect(result.adapter).toBe("0xbDa98551b18431bD95fdF21D06cBc37dA9dE943D");
    expect(result.maxStockIn).toBe("1000");
    expect(result.maxQuoteIn).toBe("100000");
    expect(result.currentPrice).toBe(100.0);
  });

  it("never confuses feedDecimals (8) with maxStaleness (604800)", () => {
    const mockTuple = {
      feed: "0x788B4d1737aeC2cFd0Af5F21f6F3D4C3CabCC41A",
      feedDecimals: 8,
      stockDecimals: 8,
      enabled: true,
      maxStaleness: 604800,
      maxDeviationBps: 500,
      adapter: "0xbDa98551b18431bD95fdF21D06cBc37dA9dE943D",
      maxStockIn: 30000000n,
      maxQuoteIn: 100000000n,
    };

    const marketDef = DEFAULT_DEPLOYMENT.markets[1]; // mAAPL
    const quoteDef = DEFAULT_DEPLOYMENT.quoteToken;
    const mockRound = { answer: 34500000000n }; // $345.00

    const result = formatMarketConfig(mockTuple, marketDef, quoteDef, mockRound, 8);

    expect(result.maxStaleness).toBe(604800);
    expect(result.maxStaleness).not.toBe(8);
    expect(result.feedDecimals).toBe(8);
    expect(result.currentPrice).toBe(345.0);
  });
});
