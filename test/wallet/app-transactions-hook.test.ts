import { describe, it, expect } from "vitest";
import { pushFeeSplitCalls } from "@/hooks/wallet/useAppTransactions";
import { LAUNCHPAD_TREASURY } from "@/lib/constants/launchpad";
import type { ContractCall } from "@/lib/utils/tx";

describe("App Transactions Hook & Utilities Suite", () => {
  it("pushes native fee transfer to treasury when no creator is specified", () => {
    const calls: ContractCall[] = [];
    const fee = BigInt(1000000000); // 1 gwei
    pushFeeSplitCalls(calls, fee, {
      native: true,
      token: "0x1111111111111111111111111111111111111111",
      creator: null,
      payer: "0x2222222222222222222222222222222222222222",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].to.toLowerCase()).toBe(LAUNCHPAD_TREASURY.toLowerCase());
    expect(calls[0].value).toBe(fee);
  });

  it("splits platform fee between creator and treasury", () => {
    const calls: ContractCall[] = [];
    const fee = BigInt(10000);
    const creator = "0x3333333333333333333333333333333333333333";
    pushFeeSplitCalls(calls, fee, {
      native: true,
      token: "0x1111111111111111111111111111111111111111",
      creator: creator as `0x${string}`,
      payer: "0x2222222222222222222222222222222222222222",
    });

    // Should create calls for creator share and platform treasury share
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const totalVal = calls.reduce((s, c) => s + (c.value ?? BigInt(0)), BigInt(0));
    expect(totalVal).toBe(fee);
  });

  it("ignores zero or negative fees safely", () => {
    const calls: ContractCall[] = [];
    pushFeeSplitCalls(calls, BigInt(0), {
      native: true,
      token: "0x1111111111111111111111111111111111111111",
      creator: null,
    });
    expect(calls).toHaveLength(0);
  });
});
