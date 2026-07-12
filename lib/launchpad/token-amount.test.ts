import { describe, expect, it } from "vitest";
import {
  amountFromBalanceFraction,
  formatTokenBalanceDisplay,
  formatTokenInputAmount,
} from "@/lib/launchpad/token-amount";

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
});
