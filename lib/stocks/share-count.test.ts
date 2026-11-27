import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import { shareCountLabel } from "./share-count";
import { formatVoucherAmount } from "@/lib/utils/voucher";
import { BASE_STOCK_DECIMALS } from "@/lib/stocks/base-stocks";
import { formatTokenAmount, tokenUnits } from "@/lib/launchpad/format";

const x = (n: string) => parseUnits(n, 18);

describe("shareCountLabel", () => {
  it("multiplies tokens by the token's shares-per-token", () => {
    expect(shareCountLabel(1, x("8"))).toBe("≈ 8 shares");
    expect(shareCountLabel(1, x("1"))).toBe("≈ 1 share");
    expect(shareCountLabel(0.5, x("1.5588"))).toBe("≈ 0.7794 shares");
  });

  it("shows nothing for an empty, dust or unreadable amount", () => {
    expect(shareCountLabel(0, x("8"))).toBeNull();
    expect(shareCountLabel(0.000001, x("1"))).toBeNull();
    expect(shareCountLabel(Number.NaN, x("1"))).toBeNull();
    expect(shareCountLabel(1, BigInt(0))).toBeNull();
  });

  it("calls a gift amount tokens, never shares", () => {
    expect(formatVoucherAmount("NVDAc", parseUnits("5", BASE_STOCK_DECIMALS))).toMatch(/^5 NVDAc tokens/);
    expect(formatVoucherAmount("NVDAc", parseUnits("1", BASE_STOCK_DECIMALS))).toMatch(/^1 NVDAc token\b/);
  });
});

describe("tokenUnits", () => {
  it("reads the amount itself, not the shortened text", () => {
    expect(formatTokenAmount("1234500000", 6)).toBe("1,234.50");
    expect(tokenUnits("1234500000", 6)).toBe(1234.5);
    expect(tokenUnits("12500000000", 6)).toBe(12500);
    expect(tokenUnits("0.5", 18)).toBe(0.5);
  });
});
