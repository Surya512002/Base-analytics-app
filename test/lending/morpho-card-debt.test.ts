import { describe, expect, it } from "vitest";
import type { PublicClient } from "viem";
import { fetchUserMorphoPosition } from "@/lib/lending/morpho-blue";

// A market with 5,000 USDC borrowed. Morpho's borrow shares carry a 1,000,000x virtual offset, so a borrower
// who owes 1,000 USDC holds 1,000 * 1e6 (USDC units) * 1e6 shares, not 1,000 * 1e6.
const TOTAL_BORROW_ASSETS = BigInt(5_000e6);
const TOTAL_BORROW_SHARES = BigInt(5_000e6) * BigInt(1_000_000);
const MY_SHARES = BigInt(1_000e6) * BigInt(1_000_000);

const market = {
  marketId: "0x1111111111111111111111111111111111111111111111111111111111111111",
  name: "NVDAc / USDC",
  ltv: 77,
  asset: { symbol: "USDC", decimals: 6 },
  collateralAsset: { symbol: "NVDAc", decimals: 8 },
  morphoParams: {
    loanToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    collateralToken: "0xb20000000000000000000078ee7ce2fE4908108C",
    oracle: "0x0000000000000000000000000000000000000001",
    irm: "0x0000000000000000000000000000000000000002",
    lltv: BigInt(77) * BigInt(10) ** BigInt(16),
  },
} as never;

const clientWith = (borrowShares: bigint, collateral: bigint, marketFails = false) =>
  ({
    readContract: async ({ functionName }: { functionName: string }) => {
      if (functionName === "position") return [BigInt(0), borrowShares, collateral];
      if (functionName === "market") {
        if (marketFails) throw new Error("rpc down");
        return [BigInt(0), BigInt(0), TOTAL_BORROW_ASSETS, TOTAL_BORROW_SHARES, BigInt(0), BigInt(0)];
      }
      throw new Error("unexpected call " + functionName);
    },
  }) as unknown as PublicClient;

const USER = "0x00000000000000000000000000000000000a11ce" as const;

describe("Morpho position card: debt", () => {
  it("shows the real USDC owed, not the share count", async () => {
    // 10 NVDAc at $200 = $2,000 of collateral, owing 1,000 USDC
    const p = await fetchUserMorphoPosition(market, USER, clientWith(MY_SHARES, BigInt(10e8)), 200);
    expect(p).not.toBeNull();
    expect(p!.borrowedUsd).toBeCloseTo(1000, 2); // the old code read this as 1,000,000,000,000 (a million times too much)
    expect(p!.borrowedFormatted).toBe("1000");
    expect(p!.borrowedAmount).toBe(BigInt(1_000e6));
    expect(p!.collateralUsd).toBeCloseTo(2000, 2);
    expect(p!.healthFactor).toBeCloseTo(1.54, 2); // 2000 * 0.77 / 1000
    expect(p!.currentLtvPct).toBeCloseTo(50, 1);
    expect(p!.availableBorrowUsd).toBeCloseTo(540, 1);
  });

  it("a position with collateral and no debt reads as no debt and needs no market lookup", async () => {
    const p = await fetchUserMorphoPosition(market, USER, clientWith(BigInt(0), BigInt(10e8), true), 200);
    expect(p!.borrowedUsd).toBe(0);
    expect(p!.healthFactor).toBe(999);
  });

  it("gives no number at all when the market cannot be read, rather than a wrong one", async () => {
    expect(await fetchUserMorphoPosition(market, USER, clientWith(MY_SHARES, BigInt(10e8), true), 200)).toBeNull();
  });
});
