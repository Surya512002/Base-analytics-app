import { describe, expect, it } from "vitest";
import {
  formatTokenAmount,
  formatUsd,
  formatEth,
  formatSubscriptPrice,
  formatCompact,
} from "./format";
import { formatTokenBalanceDisplay } from "./token-amount";

describe("Number Formatting - Anti-Scientific Notation & Accuracy", () => {
  it("formats large numbers cleanly without scientific notation", () => {
    // 3.6e43 was the exact bug reported!
    const hugeWei = "36000000000000000000000000000000000000000000";
    const formattedFromWei = formatTokenAmount(hugeWei, 18);
    expect(formattedFromWei).not.toContain("e");
    expect(formattedFromWei).not.toContain("E");
    expect(formattedFromWei).toMatch(/T$/); // Formatted as Trillions

    const oneBillion = formatTokenAmount("1000000000000000000000000000", 18); // 1B tokens
    expect(oneBillion).toBe("1.00B");

    const tenMillion = formatTokenAmount(10_000_000);
    expect(tenMillion).toBe("10.00M");

    const standard = formatTokenAmount(1234.5678);
    expect(standard).toBe("1,234.5678");
  });

  it("formats small fractional numbers cleanly without scientific notation", () => {
    // 1.2e-8 was the exact bug reported!
    const tinyMicroPrice = 0.000000012;
    const formattedToken = formatTokenAmount(tinyMicroPrice, 18);
    expect(formattedToken).not.toMatch(/e[+-]?\d+/i);
    expect(formattedToken).toBe("0.00000001");

    const formattedUsd = formatUsd(tinyMicroPrice);
    expect(formattedUsd).not.toMatch(/e[+-]?\d+/i);
    expect(formattedUsd).toMatch(/^\$0\.0/); // Subscript format like $0.0₇12

    const formattedEth = formatEth(tinyMicroPrice);
    expect(formattedEth).not.toMatch(/e[+-]?\d+/i);
    expect(formattedEth).toContain("ETH");
  });

  it("handles zero and empty values gracefully", () => {
    expect(formatTokenAmount(0)).toBe("0");
    expect(formatTokenAmount("0")).toBe("0");
    expect(formatTokenAmount(null)).toBe("0");
    expect(formatTokenAmount(undefined)).toBe("0");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(null)).toBe("—");
    expect(formatEth(0)).toBe("0 ETH");
    expect(formatEth(null)).toBe("—");
  });

  it("formatTokenBalanceDisplay never outputs scientific notation", () => {
    const tinyBalance = 0.00000005;
    const formatted = formatTokenBalanceDisplay(tinyBalance, 8);
    expect(formatted).not.toContain("e");
    expect(formatted).not.toContain("E");
    expect(formatted).toBe("0.00000005");

    const zeroBalance = formatTokenBalanceDisplay(0, 8);
    expect(zeroBalance).toBe("0");

    const largeBalance = formatTokenBalanceDisplay(12_345_678, 18);
    expect(largeBalance).toBe("12.35M");
  });

  it("formats tokenized stocks (8 decimals) accurately", () => {
    // 1.5 NVDAc shares in 8-decimal raw wei: 150_000_000
    const stockSharesRaw = BigInt(150_000_000);
    const formatted = formatTokenAmount(stockSharesRaw, 8);
    expect(formatted).toBe("1.50");

    // 0 NVDAc
    expect(formatTokenAmount(BigInt(0), 8)).toBe("0");
  });

  it("formats USD currency cleanly across all magnitudes", () => {
    expect(formatUsd(150_000_000_000)).toBe("$150.00B");
    expect(formatUsd(1_250_000)).toBe("$1.25M");
    expect(formatUsd(2_500)).toBe("$2.50K");
    expect(formatUsd(138.25)).toBe("$138.25");
    expect(formatUsd(0.05)).toBe("$0.0500");
    expect(formatUsd(0.0000452)).toMatch(/^\$0\.0/); // Subscript format
    expect(formatUsd(0.0000452)).not.toContain("e");
  });
});
