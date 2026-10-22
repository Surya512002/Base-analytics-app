import { describe, expect, it } from "vitest";
import {
  computeLaunchEconomicsBigInt,
  formatBigIntCompactUsd,
} from "@/lib/launchpad/launch-math";
import { parseUnits } from "viem";

describe("Launch Economics BigInt Math (6, 8, 18 Decimals)", () => {
  it("calculates exact market cap and token price for 6-decimal quote asset (USDC at $1.00)", () => {
    // 1B supply, start price $0.0001 => Market cap = $100,000
    const econ = computeLaunchEconomicsBigInt({
      startPriceUsd: "0.0001",
      quotePriceUsd: "1.0",
      quoteDecimals: 6, // USDC
    });

    // $0.0001 * 1B = $100,000
    expect(econ.formattedMarketCapUsd).toBe("$100.00K");

    // In USDC (6 decimals): $0.0001 / $1.0 = 0.0001 USDC
    // 0.0001 USDC in 6-decimal wei = 100
    expect(econ.pricePerTokenInQuoteWei).toBe(BigInt(100));
    expect(econ.formattedPriceQuote).toBe("0.0001");

    // Market cap in USDC = 100,000 USDC => 100000 * 1e6
    expect(econ.marketCapInQuoteWei).toBe(parseUnits("100000", 6));
  });

  it("calculates exact market cap and token price for 8-decimal quote asset (NVDAc at $135.00)", () => {
    // 1B supply, start price $0.000135 => Market cap = $135,000
    const econ = computeLaunchEconomicsBigInt({
      startPriceUsd: "0.000135",
      quotePriceUsd: "135.0",
      quoteDecimals: 8, // NVDAc tokenized stock
    });

    expect(econ.formattedMarketCapUsd).toBe("$135.00K");

    // Price per token in NVDAc: 0.000135 / 135 = 0.000001 NVDAc (1e-6)
    // In 8-decimal wei: 1e-6 * 1e8 = 100 wei
    expect(econ.pricePerTokenInQuoteWei).toBe(BigInt(100));
    expect(econ.formattedPriceQuote).toBe("0.000001");

    // Market cap in NVDAc = 1,000 NVDAc => 1000 * 1e8 = 100000000000
    expect(econ.marketCapInQuoteWei).toBe(parseUnits("1000", 8));
  });

  it("calculates exact market cap and token price for 18-decimal quote asset (ETH at $2500.00)", () => {
    // 1B supply, start price $0.0025 => Market cap = $2,500,000
    const econ = computeLaunchEconomicsBigInt({
      startPriceUsd: "0.0025",
      quotePriceUsd: "2500.0",
      quoteDecimals: 18, // ETH / WETH
    });

    expect(econ.formattedMarketCapUsd).toBe("$2.50M");

    // Price in ETH: 0.0025 / 2500 = 0.000001 ETH (1e-6 ETH)
    // In 18-decimal wei: 1e-6 * 1e18 = 1e12 wei
    expect(econ.pricePerTokenInQuoteWei).toBe(BigInt("1000000000000"));
    expect(econ.formattedPriceQuote).toBe("0.000001");

    // Market cap in ETH = 1,000 ETH
    expect(econ.marketCapInQuoteWei).toBe(parseUnits("1000", 18));
  });

  it("handles sub-penny micro pricing without underflow for 8-decimal stocks", () => {
    // Micro memestock start price: $0.000001 (1e-6) at $100 stock price => 1 wei of stock per token
    const econ = computeLaunchEconomicsBigInt({
      startPriceUsd: "0.000001",
      quotePriceUsd: "100.0",
      quoteDecimals: 8,
    });

    // $0.000001 * 1B = $1,000.00
    expect(econ.formattedMarketCapUsd).toBe("$1.00K");
    expect(econ.pricePerTokenInQuoteWei).toBe(BigInt(1));
  });

  it("formats compact USD amounts correctly across scales ($K, $M, $B)", () => {
    expect(formatBigIntCompactUsd(parseUnits("500", 18))).toBe("$500.00");
    expect(formatBigIntCompactUsd(parseUnits("45000", 18))).toBe("$45.00K");
    expect(formatBigIntCompactUsd(parseUnits("12500000", 18))).toBe("$12.50M");
    expect(formatBigIntCompactUsd(parseUnits("2500000000", 18))).toBe("$2.50B");
  });
});
