import { describe, expect, it } from "vitest";
import {
  amountFromBalanceFraction,
  amountFromRawBalanceFraction,
  formatTokenBalanceDisplay,
  formatTokenInputAmount,
  sanitizeTokenAmountInput,
} from "@/lib/launchpad/token-amount";
import { parseUnits } from "viem";

describe("token-amount", () => {
  it("formats small 8-decimal balances without rounding to zero", () => {
    expect(formatTokenBalanceDisplay(0.000045, 8)).not.toBe("0");
    expect(formatTokenInputAmount(0.000045, 8)).not.toBe("0");
  });

  it("MAX fraction keeps full cbBTC-style balance", () => {
    const amt = amountFromBalanceFraction(0.00123456, 8, 0.995);
    expect(parseFloat(amt)).toBeGreaterThan(0);
    expect(amt).toMatch(/^0\.0012/);
  });

  it("raw MAX keeps full on-chain balance without float drift", () => {
    const raw = parseUnits("1234.56789012", 8);
    const amt = amountFromRawBalanceFraction(raw, 8, 0.995);
    expect(parseFloat(amt)).toBeGreaterThan(1228);
    expect(parseFloat(amt)).toBeLessThan(1235);
    expect(amt).not.toMatch(/e/i);
  });

  it("rejects scientific notation for quotes", () => {
    expect(sanitizeTokenAmountInput("1.2e-5", 18)).toBe("");
  });
});
