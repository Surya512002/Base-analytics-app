import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";
import { buildAaveV4BorrowUsdc, buildAaveV4RepayUsdc, buildAaveV4SupplyCollateral, buildAaveV4Withdraw } from "@/lib/lending/aave-v4/calls";
import { AAVE_V4_RESERVES, AAVE_V4_SPOKE, AAVE_V4_SPOKE_ABI } from "@/lib/lending/aave-v4/constants";
import { borrowPower, healthFactor, healthLevel, liquidationPrice, maxBorrowUsd, maxWithdrawPowerUsd } from "@/lib/lending/aave-v4/math";
import { assertTrustedApprovals, isTrustedSpender, isUnlimitedApprovalAllowed } from "@/lib/security/trusted-spenders";
import { hasBuilderSuffix } from "@/lib/utils/tx";

const USER = "0x00000000000000000000000000000000000a11ce" as const;
const NVDA = AAVE_V4_RESERVES.NVDAc;
const decode = (data: `0x${string}`) => {
  const d = decodeFunctionData({ abi: AAVE_V4_SPOKE_ABI, data });
  // viem returns checksummed addresses; compare in lower case
  return { ...d, args: (d.args ?? []).map((a) => (typeof a === "string" ? a.toLowerCase() : a)) };
};

describe("Aave V4 transaction builders", () => {
  it("supply: exact approval to the spoke, supply, then switch collateral on", () => {
    const calls = buildAaveV4SupplyCollateral({ token: NVDA.address, reserveId: NVDA.id, amount: BigInt(5e8), user: USER, needsApproval: true, collateralAlreadyOn: false });
    expect(calls).toHaveLength(3);
    expect(calls[0].to.toLowerCase()).toBe(NVDA.address.toLowerCase()); // the approve goes to the stock token...
    expect(calls[0].data.toLowerCase()).toContain(AAVE_V4_SPOKE.slice(2).toLowerCase()); // ...naming the spoke as spender
    const [supply, collateral] = [decode(calls[1].data), decode(calls[2].data)];
    expect(supply.functionName).toBe("supply");
    expect(supply.args).toEqual([NVDA.id, BigInt(5e8), USER.toLowerCase()]);
    expect(collateral.functionName).toBe("setUsingAsCollateral");
    expect(collateral.args).toEqual([NVDA.id, true, USER.toLowerCase()]);
    expect(calls[1].to).toBe(AAVE_V4_SPOKE);
  });

  it("supply: skips the approval and the collateral switch when they are already in place", () => {
    const calls = buildAaveV4SupplyCollateral({ token: NVDA.address, reserveId: NVDA.id, amount: BigInt(1e8), user: USER, needsApproval: false, collateralAlreadyOn: true });
    expect(calls).toHaveLength(1);
    expect(decode(calls[0].data).functionName).toBe("supply");
  });

  it("borrow, repay and withdraw act on the user's own account, on the right reserve", () => {
    const borrow = buildAaveV4BorrowUsdc({ amount: BigInt(100e6), user: USER })[0];
    expect(decode(borrow.data).args).toEqual([AAVE_V4_RESERVES.USDC.id, BigInt(100e6), USER.toLowerCase()]);
    const repay = buildAaveV4RepayUsdc({ usdc: AAVE_V4_RESERVES.USDC.address, amount: BigInt(50e6), user: USER, needsApproval: true });
    expect(repay).toHaveLength(2);
    expect(decode(repay[1].data).functionName).toBe("repay");
    const out = buildAaveV4Withdraw({ reserveId: NVDA.id, amount: BigInt(1e8), user: USER })[0];
    expect(decode(out.data).functionName).toBe("withdraw");
  });

  it("every call carries the builder code", () => {
    const all = [
      ...buildAaveV4SupplyCollateral({ token: NVDA.address, reserveId: NVDA.id, amount: BigInt(1e8), user: USER, needsApproval: true, collateralAlreadyOn: false }),
      ...buildAaveV4BorrowUsdc({ amount: BigInt(1e6), user: USER }),
      ...buildAaveV4RepayUsdc({ usdc: AAVE_V4_RESERVES.USDC.address, amount: BigInt(1e6), user: USER, needsApproval: true }),
      ...buildAaveV4Withdraw({ reserveId: NVDA.id, amount: BigInt(1e8), user: USER }),
    ];
    for (const c of all) expect(hasBuilderSuffix(c.data)).toBe(true);
  });

  it("refuses a zero amount", () => {
    expect(() => buildAaveV4BorrowUsdc({ amount: BigInt(0), user: USER })).toThrow();
  });

  it("the approval guard knows the spoke, and allows only an exact approval to it", () => {
    expect(isTrustedSpender(AAVE_V4_SPOKE)).toBe(true);
    expect(isUnlimitedApprovalAllowed(AAVE_V4_SPOKE)).toBe(false);
    const calls = buildAaveV4SupplyCollateral({ token: NVDA.address, reserveId: NVDA.id, amount: BigInt(1e8), user: USER, needsApproval: true, collateralAlreadyOn: false });
    expect(() => assertTrustedApprovals(calls)).not.toThrow();
  });
});

describe("Aave V4 health maths", () => {
  const lines = [
    { usd: 10_000, collateralFactor: 70, on: true }, // NVDA-like
    { usd: 5_000, collateralFactor: 78, on: true },
    { usd: 9_999, collateralFactor: 79, on: false }, // not switched on: counts for nothing
  ];
  const power = borrowPower(lines); // 7000 + 3900

  it("counts only collateral that is switched on", () => {
    expect(power).toBeCloseTo(10_900);
  });

  it("health factor is power over debt, and absent without debt", () => {
    expect(healthFactor(power, 5_450)).toBeCloseTo(2);
    expect(healthFactor(power, 0)).toBeNull();
  });

  it("max borrow keeps the position at the safe health factor", () => {
    const max = maxBorrowUsd(power, 0); // 10900 / 1.5
    expect(max).toBeCloseTo(7_266.67, 1);
    expect(healthFactor(power, max)).toBeCloseTo(1.5);
    expect(maxBorrowUsd(power, 9_000)).toBe(0); // already past the safe line
  });

  it("max withdraw keeps the safe health factor when there is debt", () => {
    expect(maxWithdrawPowerUsd(power, 0)).toBeCloseTo(power);
    expect(maxWithdrawPowerUsd(power, 4_000)).toBeCloseTo(power - 6_000);
    expect(maxWithdrawPowerUsd(power, 8_000)).toBe(0);
  });

  it("labels the risk level", () => {
    expect(healthLevel(null)).toBe("none");
    expect(healthLevel(3)).toBe("safe");
    expect(healthLevel(1.7)).toBe("watch");
    expect(healthLevel(1.3)).toBe("danger");
    expect(healthLevel(1.05)).toBe("blocked");
  });

  it("liquidation price: where this stock alone would sink the position", () => {
    // $10,000 of a 70% stock plus $5,000 of a 78% stock, $8,000 debt, looking at the first stock
    const p = liquidationPrice(100, power, 8_000, 7_000);
    // needs 8000 - 3900 = 4100 of its 7000 power, so a fall of ~41%: price 58.57
    expect(p).toBeCloseTo(58.57, 1);
    expect(liquidationPrice(100, power, 0, 7_000)).toBeNull();
    expect(liquidationPrice(100, power, 3_000, 7_000)).toBeNull(); // the other stock covers it
  });
});
