import { describe, expect, it } from "vitest";
import { getUserActivityStats, lastUtcDays, recordUniqueUser, utcDay } from "@/lib/redis-unique-users";

// Tests run without Redis, so these exercise the in-memory fallback with the same logic.
describe("daily active users", () => {
  it("builds UTC day keys and a 7-day window ending today", () => {
    const now = new Date("2026-11-14T23:30:00Z");
    expect(utcDay(now)).toBe("2026-11-14");
    expect(lastUtcDays(7, now)).toEqual([
      "2026-11-08",
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
    ]);
  });

  it("counts each wallet once per day and flags first-time wallets as new", async () => {
    const before = await getUserActivityStats();
    const a = "0x" + "a1".repeat(20);
    const b = "0x" + "b2".repeat(20);
    await recordUniqueUser(a);
    await recordUniqueUser(a); // same wallet again today: no double count
    await recordUniqueUser(b);
    const after = await getUserActivityStats();
    expect(after.today - before.today).toBe(2);
    expect(after.newToday - before.newToday).toBe(2);
    expect(after.total - before.total).toBe(2);
    expect(after.last7).toHaveLength(7);
    expect(after.last7[6]).toEqual({ day: utcDay(), users: after.today });
  });
});
