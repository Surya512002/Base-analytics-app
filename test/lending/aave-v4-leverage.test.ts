import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import { LEVERAGE_SLIPPAGE_BPS, MAX_BUY_PREMIUM_PCT, MAX_LOOPS, buildLeverageCalls, maxLeverageFor, planLeverage, premiumTooHigh } from "@/lib/lending/aave-v4/leverage";
import { AAVE_V4_RESERVES, AAVE_V4_SPOKE, AAVE_V4_SPOKE_ABI } from "@/lib/lending/aave-v4/constants";
import { SAFE_HEALTH_FACTOR } from "@/lib/lending/aave-v4/math";
import { SWAP_ROUTER_02 } from "@/lib/launchpad/uniswap";
import { assertTrustedApprovals } from "@/lib/security/trusted-spenders";
import { hasBuilderSuffix } from "@/lib/utils/tx";

const USER = "0x00000000000000000000000000000000000a11ce" as const;
const NVDA = AAVE_V4_RESERVES.NVDAc;
// 10 NVDAc at $100 = $1,000 of your own money, 70% collateral factor, no other positions
const base = { priceUsd: 100, collateralFactor: 70, startTokens: 10, existingPower: 0, existingDebt: 0, buyPriceUsd: 100 };

describe("leverage planner", () => {
  it("no leverage asked means no borrowing", () => {
    const p = planLeverage({ ...base, targetLeverage: 1 });
    expect(p.steps).toEqual([]);
    expect(p.debtUsd).toBe(0);
    expect(p.healthFactor).toBeNull();
    expect(p.leverageReached).toBe(1);
  });

  it("reaches a modest target in loops and stays at or above the safe health factor", () => {
    const p = planLeverage({ ...base, targetLeverage: 1.5 });
    expect(p.leverageReached).toBeCloseTo(1.5, 2);
    expect(p.totalBorrowUsd).toBeCloseTo(500, 1); // 0.5 x $1,000
    expect(p.healthFactor!).toBeGreaterThanOrEqual(SAFE_HEALTH_FACTOR);
    expect(p.limitedBy).toBe("target");
    expect(p.steps.length).toBeGreaterThan(0);
    expect(p.steps.length).toBeLessThanOrEqual(MAX_LOOPS);
  });

  it("every borrow keeps the position at the safe line, step by step", () => {
    const p = planLeverage({ ...base, targetLeverage: 1.8 });
    let power = (1000 * 70) / 100;
    let debt = 0;
    for (const s of p.steps) {
      debt += s.borrowUsd;
      expect(power / debt).toBeGreaterThanOrEqual(SAFE_HEALTH_FACTOR - 1e-9); // before the stock it buys is added
      power += (s.minTokens * 100 * 70) / 100;
    }
  });

  it("stops at the safe limit when the target is too high", () => {
    const p = planLeverage({ ...base, targetLeverage: 5 });
    expect(p.leverageReached).toBeLessThan(2); // 70% collateral factor and a 1.5 floor cannot give 5x
    expect(p.healthFactor!).toBeGreaterThanOrEqual(SAFE_HEALTH_FACTOR);
    expect(["safe-health", "loops"]).toContain(p.limitedBy);
    expect(maxLeverageFor(base)).toBeCloseTo(p.leverageReached, 5);
  });

  it("prices the plan on the guaranteed minimum and reports what buying costs", () => {
    // each token costs $101.5 (1.5% over the $100 oracle price), so $500 buys less than $500 of stock
    const p = planLeverage({ ...base, targetLeverage: 1.5, buyPriceUsd: 101.5 });
    expect(p.buyPremiumPct).toBeCloseTo(((101.5 - 100) / 101.5) * 100, 1);
    expect(p.buyCostUsd).toBeCloseTo(500 - (500 / 101.5) * 100, 1);
    expect(p.leverageReached).toBeLessThan(1.5); // part of the borrowed money was lost to the spread
  });

  it("counts the other collateral already in the account", () => {
    const alone = planLeverage({ ...base, targetLeverage: 3 });
    const withOther = planLeverage({ ...base, targetLeverage: 3, existingPower: 5000 });
    expect(withOther.leverageReached).toBeGreaterThan(alone.leverageReached);
  });

  it("gives a liquidation price below today's, and a smaller cushion with more leverage", () => {
    const low = planLeverage({ ...base, targetLeverage: 1.3 });
    const high = planLeverage({ ...base, targetLeverage: 1.8 });
    expect(low.liquidationPrice!).toBeLessThan(100);
    expect(high.liquidationPrice!).toBeGreaterThan(low.liquidationPrice!);
    expect(high.dropToLiquidationPct!).toBeLessThan(low.dropToLiquidationPct!);
  });

  it("refuses to size anything without a start amount or a price", () => {
    expect(planLeverage({ ...base, startTokens: 0, targetLeverage: 2 }).steps).toEqual([]);
    expect(planLeverage({ ...base, buyPriceUsd: 0, targetLeverage: 2 }).steps).toEqual([]);
  });

  it("flags a swap that costs too much over the oracle price", () => {
    expect(premiumTooHigh(100 * (1 + MAX_BUY_PREMIUM_PCT / 100 - 0.001), 100)).toBe(false);
    expect(premiumTooHigh(103, 100)).toBe(true);
    expect(LEVERAGE_SLIPPAGE_BPS).toBe(100);
  });
});

describe("leverage transactions", () => {
  const calls = buildLeverageCalls({
    user: USER,
    stock: { address: NVDA.address as `0x${string}`, reserveId: NVDA.id },
    startRaw: BigInt(10e8),
    startNeedsApproval: true,
    collateralAlreadyOn: false,
    steps: [
      { borrowRaw: BigInt(400e6), minOutRaw: BigInt(39e7) },
      { borrowRaw: BigInt(200e6), minOutRaw: BigInt(19e7) },
    ],
    uniswapFee: 3000,
  });

  it("start deposit (approve, supply, collateral on) then borrow, approve, swap, approve, supply for each loop", () => {
    expect(calls).toHaveLength(3 + 5 * 2);
    const names = calls.map((c) => {
      if (c.to === AAVE_V4_SPOKE) return decodeFunctionData({ abi: AAVE_V4_SPOKE_ABI, data: c.data }).functionName;
      if (c.to.toLowerCase() === SWAP_ROUTER_02.toLowerCase()) return "swap";
      return "approve";
    });
    expect(names).toEqual(["approve", "supply", "setUsingAsCollateral", "borrow", "approve", "swap", "approve", "supply", "borrow", "approve", "swap", "approve", "supply"]);
  });

  it("borrows USDC against the user's own account and supplies exactly the guaranteed minimum", () => {
    const borrow = decodeFunctionData({ abi: AAVE_V4_SPOKE_ABI, data: calls[3].data });
    expect(borrow.args![0]).toBe(AAVE_V4_RESERVES.USDC.id);
    expect(borrow.args![1]).toBe(BigInt(400e6));
    expect(String(borrow.args![2]).toLowerCase()).toBe(USER);
    const supply = decodeFunctionData({ abi: AAVE_V4_SPOKE_ABI, data: calls[7].data });
    expect(supply.args![1]).toBe(BigInt(39e7));
  });

  it("every call carries the builder code and every approval passes the approval guard", () => {
    for (const c of calls) expect(hasBuilderSuffix(c.data)).toBe(true);
    expect(() => assertTrustedApprovals(calls)).not.toThrow();
  });

  it("rejects an empty plan, too many loops, and a step with no minimum output", () => {
    const common = { user: USER, stock: { address: NVDA.address as `0x${string}`, reserveId: NVDA.id }, startRaw: BigInt(1e8), startNeedsApproval: false, collateralAlreadyOn: true, uniswapFee: 3000 };
    expect(() => buildLeverageCalls({ ...common, steps: [] })).toThrow();
    expect(() => buildLeverageCalls({ ...common, steps: Array.from({ length: MAX_LOOPS + 1 }, () => ({ borrowRaw: BigInt(1e6), minOutRaw: BigInt(1) })) })).toThrow();
    expect(() => buildLeverageCalls({ ...common, steps: [{ borrowRaw: BigInt(1e6), minOutRaw: BigInt(0) }] })).toThrow();
  });
});
