import { describe, it, expect } from "vitest";
import { parseSwapUrlParams } from "@/lib/swap/swap-link";
import { resolveSwapToken } from "@/lib/swap/token-metadata";

describe("Swap Preselection and URL Parameter Parsing", () => {
  it("parses valid buy and sell parameters correctly", () => {
    const rawSearch = "?buy=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&sell=ETH&amount=100";
    const parsed = parseSwapUrlParams(rawSearch);
    expect(parsed.buy).toBe("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
    expect(parsed.sell).toBe("eth");
    expect(parsed.amount).toBe("100");
  });

  it("resolves canonical token metadata without throwing", async () => {
    const res = await resolveSwapToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(res.counter).toBeDefined();
    if (res.counter && res.counter.kind === "token") {
      expect(res.counter.symbol).toBe("USDC");
      expect(res.counter.decimals).toBe(6);
    } else {
      throw new Error("Expected token counter");
    }
  });

  it("handles null or invalid token gracefully with error", async () => {
    const res = await resolveSwapToken("invalid-non-address");
    expect(res.error).toBeDefined();
    expect(res.counter).toBeFalsy();
  });
});
