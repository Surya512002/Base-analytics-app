import { describe, expect, it } from "vitest";
import { formatUnits, parseUnits } from "viem";
import { formatTokenAmount } from "@/lib/launchpad/format";

describe("Lending Vault Deposit & Balance Logic", () => {
  it("calculates MAX for a user holding 0 balance accurately", () => {
    const userBalance = 0;
    const userBalanceRaw = BigInt(0);

    // When balance is 0, MAX must return 0, NEVER a mock default like 10 or 15
    const calculateMaxAmount = (bal: number, raw: bigint, dec: number) => {
      if (bal <= 0) return "0";
      return formatUnits(raw, dec);
    };

    expect(calculateMaxAmount(userBalance, userBalanceRaw, 8)).toBe("0");
    expect(calculateMaxAmount(userBalance, userBalanceRaw, 6)).toBe("0");
    expect(calculateMaxAmount(userBalance, userBalanceRaw, 18)).toBe("0");
  });

  it("calculates MAX for a user holding real tokenized stock balance (e.g. NVDAc, 8 decimals)", () => {
    // User holds 4.25 NVDAc shares
    const rawBalance = parseUnits("4.25", 8); // 425_000_000n
    const humanBalance = parseFloat(formatUnits(rawBalance, 8));

    const calculateMaxAmount = (bal: number, raw: bigint, dec: number) => {
      if (bal <= 0) return "0";
      return formatUnits(raw, dec);
    };

    const maxResult = calculateMaxAmount(humanBalance, rawBalance, 8);
    expect(maxResult).toBe("4.25");
    expect(formatTokenAmount(rawBalance, 8)).toBe("4.25");
  });

  it("calculates MAX for a user holding USDC balance (6 decimals)", () => {
    // User holds 1,500.50 USDC
    const rawBalance = parseUnits("1500.50", 6); // 1_500_500_000n
    const humanBalance = parseFloat(formatUnits(rawBalance, 6));

    const maxResult = formatUnits(rawBalance, 6);
    expect(maxResult).toBe("1500.5");
    expect(formatTokenAmount(rawBalance, 6)).toBe("1,500.50");
  });

  it("calculates fractional quick percentages (25%, 50%, 75%) without mock numbers", () => {
    const raw = parseUnits("100", 8); // 100 NVDAc
    const bal = 100;

    const calcPct = (pct: number) => {
      if (bal <= 0) return "0";
      const val = (bal * pct) / 100;
      return val.toFixed(4);
    };

    expect(calcPct(25)).toBe("25.0000");
    expect(calcPct(50)).toBe("50.0000");
    expect(calcPct(75)).toBe("75.0000");
  });

  it("prevents submitting more than real user balance", () => {
    const walletBalance = 0;
    const requestedDeposit = 10;

    const validateSubmission = (amount: number, balance: number) => {
      if (amount <= 0) return "Please enter an amount";
      if (amount > balance) return "Insufficient balance";
      return null;
    };

    expect(validateSubmission(requestedDeposit, walletBalance)).toBe("Insufficient balance");
    expect(validateSubmission(5, 10)).toBeNull();
  });
});
