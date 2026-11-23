import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/lending/aave-v4/read", () => ({
  readAaveV4Overview: async () => ({
    stocks: [
      { symbol: "NVDAc", reserveId: BigInt(5), address: "0xb20000000000000000000078ee7ce2fE4908108C", decimals: 8, collateralFactor: 70, riskPremium: 0, priceUsd: 133, supplied: 100, supplyCap: 45000, capUsedPct: 1, suppliedUsd: 13_300, paused: false, frozen: false },
      { symbol: "SPCXc", reserveId: BigInt(8), address: "0xb2000000000000000000007b9fcbd005511aCBd5", decimals: 8, collateralFactor: 55, riskPremium: 10, priceUsd: 131, supplied: 37_000, supplyCap: 37000, capUsedPct: 100, suppliedUsd: 4_847_000, paused: false, frozen: false },
      { symbol: "TSLAc", reserveId: BigInt(6), address: "0xb2000000000000000000001e800a7f5189430cD0", decimals: 8, collateralFactor: 65, riskPremium: 0, priceUsd: 358, supplied: 1, supplyCap: 14000, capUsedPct: 0, suppliedUsd: 358, paused: true, frozen: false },
    ],
    usdc: { borrowApr: 3.39, supplyApy: 2.3, utilization: 76.2, totalSuppliedUsd: 9_960_000, totalBorrowedUsd: 7_590_000, availableUsd: 2_371_000, borrowCapUsd: 21_000_000, supplyCapUsd: 32_000_000, borrowable: true },
  }),
}));

import { aaveV4Adapter } from "@/lib/lending/discovery/adapters/aave-v4";
import { AAVE_V4_SPOKE } from "@/lib/lending/aave-v4/constants";

describe("Aave V4 discovery adapter", () => {
  it("turns each stock reserve into a USDC borrow market on the spoke", async () => {
    const markets = await aaveV4Adapter.discoverMarkets(8453);
    expect(markets).toHaveLength(3);
    const nvda = markets[0];
    expect(nvda.protocol).toBe("aave_v4");
    expect(nvda.type).toBe("borrow");
    expect(nvda.collateralAsset?.symbol).toBe("NVDAc");
    expect(nvda.borrowAsset?.symbol).toBe("USDC");
    expect(nvda.maxLtv).toBe(70);
    expect(nvda.borrowApr).toBe(3.39);
    expect(nvda.supplyApy).toBe(0); // collateral only: no yield on the stock
    expect(nvda.contractAddress).toBe(AAVE_V4_SPOKE); // the approval spender
    expect(nvda.oracle.isVerified).toBe(true);
    expect(nvda.oracle.address).toBeTruthy(); // the engine refuses borrow markets without a known oracle
    expect(nvda.canSupply && nvda.canBorrow && nvda.canUseAsCollateral).toBe(true);
    expect(nvda.riskFlags).toEqual(["COLLATERAL_ONLY"]);
  });

  it("adds a collateral's risk premium to its borrow rate and flags a full supply cap", async () => {
    const spcx = (await aaveV4Adapter.discoverMarkets(8453))[1];
    expect(spcx.borrowApr).toBe(13.39);
    expect(spcx.riskFlags).toContain("RISK_PREMIUM");
    expect(spcx.riskFlags).toContain("SUPPLY_CAP_REACHED");
    expect(spcx.canSupply).toBe(false);
    expect(spcx.status).toBe("cap_reached");
  });

  it("marks a paused reserve as paused and unusable", async () => {
    const tsla = (await aaveV4Adapter.discoverMarkets(8453))[2];
    expect(tsla.status).toBe("paused");
    expect(tsla.canSupply || tsla.canBorrow || tsla.canUseAsCollateral).toBe(false);
    expect(tsla.riskFlags).toContain("PAUSED");
  });
});
