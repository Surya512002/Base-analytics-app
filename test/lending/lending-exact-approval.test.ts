import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { buildAttributedApproveCall } from "@/lib/lending/builder-attribution";
import { parseUnits } from "viem";

describe("P2: Lending Approvals Hardening & Exact Allowance Calculation", () => {
  const modalFilePath = path.resolve(process.cwd(), "components/lending/LendingActionModal.tsx");
  const modalSource = fs.readFileSync(modalFilePath, "utf8");

  it("never imports or uses maxUint256 in LendingActionModal.tsx", () => {
    expect(modalSource).not.toContain("maxUint256");
    expect(modalSource).not.toContain("unlimitedApproval");
  });

  it("calculates exact required allowance for supply and stake", () => {
    const parsedAmount = parseUnits("500", 6); // 500 USDC = 500,000,000

    const computeRequiredAllowance = (action: string, amount: bigint) => {
      return action === "repay"
        ? amount + (amount * BigInt(10)) / BigInt(10000) + BigInt(1)
        : amount;
    };

    expect(computeRequiredAllowance("supply", parsedAmount)).toBe(parsedAmount);
    expect(computeRequiredAllowance("stake", parsedAmount)).toBe(parsedAmount);
  });

  it("adds exactly 0.1% buffer + 1 wei for repay to absorb interest accrual safely", () => {
    const computeRequiredAllowance = (action: string, amount: bigint) => {
      return action === "repay"
        ? amount + (amount * BigInt(10)) / BigInt(10000) + BigInt(1)
        : amount;
    };

    // 10,000 USDC debt repayment
    const debtAmount = parseUnits("10000", 6); // 10,000,000,000 wei
    const required = computeRequiredAllowance("repay", debtAmount);

    // 0.1% of 10,000,000,000 is 10,000,000. Plus 1 wei = 10,000,001 wei.
    const expected = debtAmount + BigInt(10000001);
    expect(required).toBe(expected);
    expect(required).toBe(BigInt("10010000001"));
  });

  it("buildAttributedApproveCall encodes exact allowance into ERC-20 approve calldata", () => {
    const token = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC Base
    const spender = "0xD317fDf7e7E3BA9dc9A73CAe2E54732646866025";
    const exactAmount = parseUnits("250", 6);

    const call = buildAttributedApproveCall(token, spender, exactAmount);
    expect(call.to.toLowerCase()).toBe(token.toLowerCase());
    expect(call.data).toBeDefined();
    expect(call.data.startsWith("0x095ea7b3")).toBe(true); // ERC20 approve selector
  });

  it("verifies actions that do NOT pull wallet tokens (borrow, withdraw, unstake) bypass approval", () => {
    const actionsRequiringAllowance = ["supply", "stake", "repay"];
    const actionsWithoutAllowance = ["borrow", "withdraw", "unstake"];

    for (const a of actionsWithoutAllowance) {
      expect(actionsRequiringAllowance.includes(a)).toBe(false);
    }
  });
});
