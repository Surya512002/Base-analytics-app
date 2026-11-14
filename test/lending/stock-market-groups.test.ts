import { describe, expect, it } from "vitest";
import {
  borrowCapacity,
  classifyStockMarket,
  groupMarketsByStock,
  isApyUnreliable,
  venueLabel,
  yearlyEarnings,
} from "@/lib/lending/stock-market-groups";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";

const AAPL = { symbol: "AAPLc", name: "Apple", address: "0xb200000000000000000000C2e324d24d7eEcd1fb", decimals: 8, isStock: true } as const;
const USDC = { symbol: "USDC", name: "USD Coin", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, isStock: false } as const;

const base = (over: Partial<NormalizedMarket>): NormalizedMarket =>
  ({
    protocol: "beefy",
    protocolLabel: "Beefy Finance",
    marketId: Math.random().toString(36),
    type: "stake",
    supplyAsset: AAPL,
    collateralAsset: AAPL,
    supplyApy: 5,
    maxLtv: 0,
    liquidityUsd: 50_000,
    tvlUsd: 50_000,
    utilization: 0,
    oracle: { name: "x", isVerified: true },
    canSupply: true,
    canBorrow: false,
    canUseAsCollateral: false,
    riskFlags: [],
    sourceLink: "https://example.com",
    lastUpdated: "",
    status: "active",
    ...over,
  }) as NormalizedMarket;

describe("verified stock market grouping", () => {
  const morpho = base({ protocol: "morpho", type: "borrow", supplyAsset: USDC, borrowApr: 6.2, maxLtv: 62.5, liquidityUsd: 1500 });
  const aave = base({ badgeText: "Lends your stock on Aave v4", supplyApy: 3 });
  const lp = base({ supplyAsset: { ...AAPL, symbol: "AAPLc-USDC" }, supplyApy: 14 });
  const dustHype = base({ supplyAsset: { ...AAPL, symbol: "AAPLc-USDC" }, supplyApy: 900, tvlUsd: 20, liquidityUsd: 20 });

  it("classifies borrow, single-stock lending and LP positions", () => {
    expect(classifyStockMarket(morpho)).toBe("borrow");
    expect(classifyStockMarket(aave)).toBe("lend");
    expect(classifyStockMarket(lp)).toBe("lp");
    expect(venueLabel(aave)).toBe("Aave v4 · Beefy");
  });

  it("rolls markets up per stock and ignores unreliable dust APYs for 'best'", () => {
    expect(isApyUnreliable(dustHype)).toBe(true);
    const [g] = groupMarketsByStock([morpho, aave, lp, dustHype]);
    expect(g.symbol).toBe("AAPLc");
    expect(g.markets).toHaveLength(4);
    expect(g.bestEarn?.supplyApy).toBe(14);
    expect(g.bestBorrow?.borrowApr).toBe(6.2);
    expect(g.maxLtv).toBe(62.5);
    expect(g.kinds.sort()).toEqual(["borrow", "lend", "lp"]);
  });

  it("can hide dust markets", () => {
    const [g] = groupMarketsByStock([lp, dustHype], 1000);
    expect(g.markets).toHaveLength(1);
  });

  it("computes earnings and a conservative borrow", () => {
    expect(yearlyEarnings(1000, 5)).toBe(50);
    const b = borrowCapacity(10_000, 62.5, 6);
    expect(b.max).toBe(6250);
    expect(b.safe).toBe(3125);
    expect(b.yearlyInterestOnSafe).toBeCloseTo(187.5);
  });
});
