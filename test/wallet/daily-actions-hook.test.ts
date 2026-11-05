import { describe, it, expect } from "vitest";
import { createDailyActionCalls } from "@/hooks/wallet/useDailyActions";
import {
  BOOSTER_CONTRACT,
  CHECKIN_CONTRACT,
  GM_GN_CONTRACT,
} from "@/lib/constants/contracts";
import { DEFAULT_TX_KEYS, bumpWeeklyTxKey } from "@/lib/utils/wallet-session";
import { msUntilNextUtcDay } from "@/lib/utils/calendar-rollover";

describe("Daily Actions Hook and Logic Suite", () => {
  it("encodes valid onchain calls for boost, gm, gn, and checkIn", () => {
    const calls = createDailyActionCalls();

    expect(calls.boostCall).toHaveLength(1);
    expect(calls.boostCall[0].to.toLowerCase()).toBe(BOOSTER_CONTRACT.toLowerCase());
    expect(calls.boostCall[0].data.startsWith("0x")).toBe(true);

    expect(calls.gmCall).toHaveLength(1);
    expect(calls.gmCall[0].to.toLowerCase()).toBe(GM_GN_CONTRACT.toLowerCase());
    expect(calls.gmCall[0].data.startsWith("0x")).toBe(true);

    expect(calls.gnCall).toHaveLength(1);
    expect(calls.gnCall[0].to.toLowerCase()).toBe(GM_GN_CONTRACT.toLowerCase());
    expect(calls.gnCall[0].data.startsWith("0x")).toBe(true);

    expect(calls.ciCall).toHaveLength(1);
    expect(calls.ciCall[0].to.toLowerCase()).toBe(CHECKIN_CONTRACT.toLowerCase());
    expect(calls.ciCall[0].data.startsWith("0x")).toBe(true);
  });

  it("calculates positive time until next UTC day", () => {
    const ms = msUntilNextUtcDay();
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it("increments weekly tx keys correctly", () => {
    const address = "0x1111111111111111111111111111111111111111";
    const nextBoost = bumpWeeklyTxKey(address, "boost");
    expect(nextBoost.boost).toBeGreaterThanOrEqual(1);

    const nextGm = bumpWeeklyTxKey(address, "gm");
    expect(nextGm.gm).toBeGreaterThanOrEqual(1);
  });

  it("provides clean default transaction keys structure", () => {
    expect(DEFAULT_TX_KEYS.boost).toBe(0);
    expect(DEFAULT_TX_KEYS.gm).toBe(0);
    expect(DEFAULT_TX_KEYS.gn).toBe(0);
    expect(DEFAULT_TX_KEYS.checkin).toBe(0);
  });
});
