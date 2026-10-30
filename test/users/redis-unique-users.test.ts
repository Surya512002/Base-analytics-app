import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  recordUniqueUser,
  getUniqueUserCount,
  getFormattedUniqueUserCount,
} from "@/lib/redis-unique-users";

describe("Redis Unique Users Tracker", () => {
  it("returns at least the baseline count for unique users", async () => {
    const count = await getUniqueUserCount();
    expect(count).toBeGreaterThanOrEqual(1420);
  });

  it("formats the unique user count as a readable localized string", async () => {
    const formatted = await getFormattedUniqueUserCount();
    expect(formatted).toMatch(/^[0-9,]+$/);
  });

  it("ignores invalid address strings safely", async () => {
    const countBefore = await getUniqueUserCount();
    const countAfter = await recordUniqueUser("invalid-address");
    expect(countAfter).toBe(countBefore);
  });

  it("deduplicates valid wallet addresses", async () => {
    const testAddr = "0x1111111111111111111111111111111111111111";
    const firstAdd = await recordUniqueUser(testAddr);
    const secondAdd = await recordUniqueUser(testAddr);
    expect(secondAdd).toBe(firstAdd);
  });
});
