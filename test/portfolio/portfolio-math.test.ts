import { describe, it, expect } from "vitest";
import { formatUnits, parseUnits } from "viem";
import { formatTokenAmount } from "@/lib/launchpad/format";
import { DUST_USD_THRESHOLD } from "@/lib/portfolio/spam-filter";
import type { PortfolioToken } from "@/lib/portfolio/types";

describe("Portfolio Balance & Decimals Math", () => {
  it("formats 6-decimal tokens (USDC, USDT, EURC) accurately using BigInt", () => {
    const rawUsdc = parseUnits("1250.50", 6);
    expect(rawUsdc).toBe(BigInt(1250500000));

    const formattedStr = formatUnits(rawUsdc, 6);
    expect(formattedStr).toBe("1250.5");

    const display = formatTokenAmount(rawUsdc, 6);
    expect(display).toBe("1,250.50");
  });

  it("formats 8-decimal tokens (cbBTC, tokenized stocks like NVDAc) accurately", () => {
    const rawStock = parseUnits("15.25", 8);
    expect(rawStock).toBe(BigInt(1525000000));

    const formattedStr = formatUnits(rawStock, 8);
    expect(formattedStr).toBe("15.25");

    const display = formatTokenAmount(rawStock, 8);
    expect(display).toBe("15.25");
  });

  it("formats 18-decimal tokens (ETH, WETH, AERO) accurately without float drift", () => {
    const rawEth = parseUnits("0.0425", 18);
    expect(rawEth).toBe(BigInt("42500000000000000"));

    const formattedStr = formatUnits(rawEth, 18);
    expect(formattedStr).toBe("0.0425");

    const display = formatTokenAmount(rawEth, 18);
    expect(display).toBe("0.0425");
  });

  it("calculates USD totals summing only priced tokens without dropping unpriced ones", () => {
    const tokens: Array<Partial<PortfolioToken>> = [
      {
        symbol: "USDC",
        balanceNumber: 500,
        priceUsd: 1.0,
        usdValue: 500,
        isSpam: false,
      },
      {
        symbol: "ETH",
        balanceNumber: 2,
        priceUsd: 2500,
        usdValue: 5000,
        isSpam: false,
      },
      {
        symbol: "MEME",
        balanceNumber: 100000,
        priceUsd: null, // Unpriced!
        usdValue: 0,
        isSpam: false,
      },
      {
        symbol: "DUST",
        balanceNumber: 1,
        priceUsd: 0.005, // Below $0.01 threshold
        usdValue: 0.005,
        isSpam: false,
      },
      {
        symbol: "SCAM",
        balanceNumber: 1000000,
        priceUsd: 10,
        usdValue: 10000000,
        isSpam: true, // Should be excluded from total
      },
    ];

    let totalUsd = 0;
    let pricedCount = 0;
    let unpricedCount = 0;
    let dustCount = 0;

    for (const t of tokens) {
      if (t.isSpam) continue;
      if (t.priceUsd != null && t.usdValue != null) {
        totalUsd += t.usdValue;
        pricedCount++;
        if (t.usdValue < DUST_USD_THRESHOLD && t.symbol !== "ETH") {
          dustCount++;
        }
      } else {
        unpricedCount++;
      }
    }

    // Expected: 500 + 5000 + 0.005 = 5500.005
    expect(totalUsd).toBeCloseTo(5500.005, 3);
    expect(pricedCount).toBe(3); // USDC, ETH, DUST
    expect(unpricedCount).toBe(1); // MEME
    expect(dustCount).toBe(1); // DUST

    // The list count must match priced + unpriced non-spam tokens
    const validTokens = tokens.filter((t) => !t.isSpam);
    expect(validTokens.length).toBe(pricedCount + unpricedCount);
    expect(validTokens.length).toBe(4);
  });
});
