import { describe, expect, it } from "vitest";
import { nextRunText, summarizeAutomation } from "@/lib/plans/automation-summary";
import type { OnChainPlan } from "@/src/lib/limitOrders/types";

const plan = (over: Partial<OnChainPlan>): OnChainPlan => ({
  id: 1n,
  owner: "0x1111111111111111111111111111111111111111",
  status: 1,
  remaining: 4,
  interval: 604_800,
  nextTime: 1_000,
  stockToken: "0x2222222222222222222222222222222222222222",
  maxPrice: 0n,
  amountPerBuy: 5_000_000n,
  isSell: false,
  ...over,
});

describe("summarizeAutomation", () => {
  it("counts only running plans and the USDC still held for buys", () => {
    const s = summarizeAutomation([
      plan({ nextTime: 900 }),
      plan({ id: 2n, isSell: true, amountPerBuy: 100n, nextTime: 500 }),
      plan({ id: 3n, status: 3, nextTime: 1 }), // cancelled
      plan({ id: 4n, remaining: 0, nextTime: 1 }), // finished
    ]);
    expect(s).toEqual({ running: 2, heldForBuys: 20_000_000n, nextRun: 500 });
  });

  it("is empty with nothing running", () => {
    expect(summarizeAutomation([])).toEqual({ running: 0, heldForBuys: 0n, nextRun: null });
  });
});

describe("nextRunText", () => {
  it("reads naturally at each size", () => {
    expect(nextRunText(100, 100)).toBe("due now");
    expect(nextRunText(130, 100)).toBe("in 1 min");
    expect(nextRunText(7_300, 100)).toBe("in 2 h");
    expect(nextRunText(86_500, 100)).toBe("in 1 day");
    expect(nextRunText(604_900, 100)).toBe("in 7 days");
  });
});
