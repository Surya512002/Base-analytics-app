import { describe, expect, it, vi } from "vitest";
import type { PublicClient } from "viem";

vi.mock("@/lib/lending/aave-v4/read", () => ({
  readAaveV4Overview: async () => ({
    stocks: [
      { symbol: "NVDAc", reserveId: BigInt(5), address: "0xb20000000000000000000078ee7ce2fE4908108C", decimals: 8, collateralFactor: 70, riskPremium: 0, priceUsd: 100, supplied: 1, supplyCap: 1000, capUsedPct: 0, suppliedUsd: 100, paused: false, frozen: false },
      { symbol: "AAPLc", reserveId: BigInt(0), address: "0xb200000000000000000000C2e324d24d7eEcd1fb", decimals: 8, collateralFactor: 78, riskPremium: 0, priceUsd: 350, supplied: 1, supplyCap: 1000, capUsedPct: 0, suppliedUsd: 350, paused: false, frozen: false },
    ],
    usdc: { borrowApr: 3.39, supplyApy: 2.3, utilization: 76, totalSuppliedUsd: 1, totalBorrowedUsd: 1, availableUsd: 1, borrowCapUsd: 1, supplyCapUsd: 1, borrowable: true },
  }),
  readAaveV4Position: async () => mockPosition.current,
}));
const mockPosition = { current: null as unknown };

import { readAaveV4PositionRows } from "@/lib/lending/aave-v4/positions";
import { morphoDebtAssets, morphoHealth } from "@/lib/lending/morpho-positions";

const USER = "0x00000000000000000000000000000000000a11ce" as const;
const client = {} as PublicClient;

describe("Aave V4 position rows", () => {
  it("makes no rows for an empty wallet", async () => {
    mockPosition.current = { collateral: [], debtUsdc: 0, healthFactor: null, borrowableUsd: 0 };
    expect(await readAaveV4PositionRows(client, USER)).toEqual([]);
  });

  it("one row per collateral stock plus a USDC debt row, wired to the market's own id", async () => {
    mockPosition.current = {
      collateral: [
        { symbol: "NVDAc", reserveId: BigInt(5), tokens: 10, usd: 1000, collateralOn: true, collateralFactor: 70 },
        { symbol: "AAPLc", reserveId: BigInt(0), tokens: 2, usd: 700, collateralOn: false, collateralFactor: 78 },
      ],
      debtUsdc: 400,
      healthFactor: 1.75,
      borrowableUsd: 300,
    };
    const rows = await readAaveV4PositionRows(client, USER);
    expect(rows).toHaveLength(3);
    const nvda = rows.find((r) => r.assetSymbol === "NVDAc" && r.type === "supplied")!;
    expect(nvda.marketId).toBe("aave_v4-equities-nvdac"); // matches the comparison option id the panel opens
    expect(nvda.suppliedUsd).toBe(1000);
    expect(nvda.healthFactor).toBe(1.75);
    expect(nvda.ltv).toBeCloseTo((400 / 1700) * 100);
    // NVDAc power 700, debt 400, AAPLc is off so it adds nothing: price must fall to 100 × 400/700 ≈ 57.14
    expect(nvda.liquidationPrice).toBeCloseTo(57.14, 1);
    const aapl = rows.find((r) => r.assetSymbol === "AAPLc")!;
    expect(aapl.suppliedFormatted).toContain("collateral off");
    expect(aapl.liquidationPrice).toBeNull();
    const debt = rows.find((r) => r.type === "borrowed")!;
    expect(debt.borrowedUsd).toBe(400);
    expect(debt.canRepay).toBe(true);
    expect(debt.marketId).toBe("aave_v4-equities-nvdac"); // repay opens from the biggest collateral
    expect(debt.apr).toBe(3.39);
  });

  it("collateral without debt has no health factor and no liquidation price", async () => {
    mockPosition.current = { collateral: [{ symbol: "NVDAc", reserveId: BigInt(5), tokens: 1, usd: 100, collateralOn: true, collateralFactor: 70 }], debtUsdc: 0, healthFactor: null, borrowableUsd: 70 };
    const rows = await readAaveV4PositionRows(client, USER);
    expect(rows).toHaveLength(1);
    expect(rows[0].healthFactor).toBeNull();
    expect(rows[0].liquidationPrice).toBeNull();
  });
});

describe("Morpho debt and health maths", () => {
  it("converts borrow shares to USDC with Morpho's virtual shares (not 1:1)", () => {
    // 1,000 USDC debt from a market where 5,000 USDC is borrowed against 5,000 * 1e6 shares
    const totalAssets = BigInt(5_000e6);
    const totalShares = BigInt(5_000e6) * BigInt(1_000_000);
    const myShares = BigInt(1_000e6) * BigInt(1_000_000);
    const debt = morphoDebtAssets(myShares, totalAssets, totalShares);
    expect(Number(debt) / 1e6).toBeCloseTo(1000, 3);
    // reading the shares as if they were USDC would be a million times too big
    expect(Number(myShares) / 1e6).toBeGreaterThan(1e8);
  });

  it("rounds the debt up and handles an empty market", () => {
    expect(morphoDebtAssets(BigInt(1), BigInt(0), BigInt(0))).toBe(BigInt(1)); // 1 share of an empty market: ceil(1 / 1e6) = 1
    expect(morphoDebtAssets(BigInt(0), BigInt(5), BigInt(5))).toBe(BigInt(0));
  });

  it("health factor is collateral value x LLTV over debt; none without debt", () => {
    // 10 stock tokens (8 decimals) worth $100 each = $1,000 = 1,000e6 USDC units. Oracle price scale: 1e36 * (1e6 / 1e8) * 100
    const oraclePrice = BigInt(100) * BigInt(10) ** BigInt(36) * BigInt(1e6) / BigInt(1e8);
    const lltv = BigInt(77) * BigInt(10) ** BigInt(16); // 77%
    const h = morphoHealth({ collateral: BigInt(10e8), oraclePrice, lltv, debt: BigInt(385e6) });
    expect(Number(h.collateralValue) / 1e6).toBeCloseTo(1000, 3);
    expect(h.healthFactor).toBeCloseTo(2, 2); // 1000 * 0.77 / 385
    expect(h.ltvPct).toBeCloseTo(38.5, 2);
    expect(h.liquidationPriceRatio).toBeCloseTo(0.5, 2); // the price can halve
    expect(morphoHealth({ collateral: BigInt(10e8), oraclePrice, lltv, debt: BigInt(0) }).healthFactor).toBeNull();
  });
});
