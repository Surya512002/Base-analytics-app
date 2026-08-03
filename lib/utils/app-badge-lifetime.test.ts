import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLifetimeBadgeMetrics,
  ensureLifetimeFloors,
  incrementLifetimeAppStat,
  readLifetimeAppStats,
} from "@/lib/utils/app-badge-lifetime";
import { getAppBadgeMetricValue } from "@/lib/utils/app-badge-levels";

const ADDR = "0xabcdef1234567890123456789012345678901234";

function mockBrowserStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  });
}

describe("app badge lifetime", () => {
  beforeEach(() => {
    mockBrowserStorage();
  });

  it("accumulates checkin/gm/boost across increments", () => {
    incrementLifetimeAppStat(ADDR, "checkin");
    incrementLifetimeAppStat(ADDR, "checkin");
    incrementLifetimeAppStat(ADDR, "gm", 3);
    incrementLifetimeAppStat(ADDR, "boost");
    const stats = readLifetimeAppStats(ADDR);
    expect(stats.checkin).toBe(2);
    expect(stats.gm).toBe(3);
    expect(stats.boost).toBe(1);
    expect(stats.social_ping).toBe(3);
  });

  it("seeds floors from on-chain totals without lowering", () => {
    incrementLifetimeAppStat(ADDR, "checkin", 2);
    ensureLifetimeFloors(ADDR, { checkin: 10, boost: 5, gm: 8 });
    ensureLifetimeFloors(ADDR, { checkin: 4 }); // lower — ignored
    const stats = readLifetimeAppStats(ADDR);
    expect(stats.checkin).toBe(10);
    expect(stats.boost).toBe(5);
    expect(stats.gm).toBe(8);
  });

  it("buildLifetimeBadgeMetrics prefers max of lifetime, weekly, floors", () => {
    ensureLifetimeFloors(ADDR, { checkin: 12, boost: 2 });
    const metrics = buildLifetimeBadgeMetrics({
      address: ADDR,
      streak: 9,
      referralInvites: 0,
      weeklyTxKeys: { checkin: 1, boost: 4, gm: 2 },
      floors: { checkin: 20, gm: 15 },
    });
    expect(metrics.checkin).toBe(20);
    expect(metrics.boost).toBe(4);
    expect(metrics.gm).toBe(15);
    expect(metrics.streak).toBe(9);
    expect(getAppBadgeMetricValue("checkin", metrics)).toBe(20);
  });
});
