import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  creditActivityFromCount,
  DAILY_POINTS_CAP,
  getTodayPointsSummary,
  recordConfirmedInAppAction,
} from "@/lib/utils/daily-points";
import { getWeekKey } from "@/lib/utils/dates";
import { todayUtcKey } from "@/lib/utils/check-in-status";

const SWAP_PP = 25;
const ADDR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function mockBrowserStorage() {
  const store = new Map<string, string>();
  const api = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal("window", {
    localStorage: api,
    dispatchEvent: () => true,
  });
  vi.stubGlobal("localStorage", api);
  return {
    ...api,
    keys: () => [...store.keys()],
    setRaw: (key: string, value: string) => store.set(key, value),
  };
}

describe("creditActivityFromCount", () => {
  let storage: ReturnType<typeof mockBrowserStorage>;

  beforeEach(() => {
    storage = mockBrowserStorage();
  });

  it("credits full PP and advances synced count", () => {
    const first = creditActivityFromCount(ADDR, "swap", 1);
    expect(first.credited).toBe(SWAP_PP);
    expect(first.changed).toBe(true);

    const again = creditActivityFromCount(ADDR, "swap", 1);
    expect(again.credited).toBe(0);
    expect(again.changed).toBe(false);
  });

  it("does not permanently burn leftover PP when a fill is partial", () => {
    const week = getWeekKey(new Date().toISOString());
    const today = todayUtcKey();
    const ledgerKey = `base_daily_pts_v3_${ADDR}_${week}`;
    const syncedKey = `base_act_synced_v3_swap_${ADDR}_${week}`;

    // 190 activity → 10 PP room; synced already at 7 full swaps.
    storage.setRaw(
      ledgerKey,
      JSON.stringify({
        [today]: {
          activity: DAILY_POINTS_CAP - 10,
          streak: 0,
          bonus: 0,
          txs: 7,
          capBonusAwarded: false,
        },
      })
    );
    storage.setRaw(syncedKey, "7");

    expect(getTodayPointsSummary(ADDR).remaining).toBe(10);

    const partial = creditActivityFromCount(ADDR, "swap", 8);
    expect(partial.credited).toBe(10);
    expect(partial.hitCap).toBe(true);
    expect(getTodayPointsSummary(ADDR).remaining).toBe(0);
    // Synced must stay at 7 — the 8th action was only partially paid.
    expect(localStorage.getItem(syncedKey)).toBe("7");

    // Simulate next UTC day with fresh room; same week synced key.
    storage.setRaw(
      ledgerKey,
      JSON.stringify({
        [today]: {
          activity: 0,
          streak: 0,
          bonus: 0,
          txs: 0,
          capBonusAwarded: false,
        },
      })
    );

    const catchUp = creditActivityFromCount(ADDR, "swap", 8);
    expect(catchUp.credited).toBe(SWAP_PP);
    expect(localStorage.getItem(syncedKey)).toBe("8");
  });
});

describe("recordConfirmedInAppAction", () => {
  beforeEach(() => {
    mockBrowserStorage();
  });

  it("increments txs even when PP is already capped", () => {
    let count = 0;
    while (getTodayPointsSummary(ADDR).remaining > 0) {
      count += 1;
      recordConfirmedInAppAction(ADDR, "swap", count);
    }
    if (getTodayPointsSummary(ADDR).remaining > 0) {
      count += 1;
      recordConfirmedInAppAction(ADDR, "swap", count);
    }

    const beforeTxs = getTodayPointsSummary(ADDR).txs;
    count += 1;
    const out = recordConfirmedInAppAction(ADDR, "swap", count);
    expect(out.credited).toBe(0);
    expect(out.hitCap).toBe(true);
    expect(out.txsToday).toBe(beforeTxs + 1);
    expect(getTodayPointsSummary(ADDR).txs).toBe(beforeTxs + 1);
    expect(DAILY_POINTS_CAP).toBe(200);
  });
});
