import { describe, it, expect } from "vitest";
import {
  recordUniqueUser,
  getUniqueUserCount,
  getFormattedUniqueUserCount,
  isValidEthAddress,
  extractAddressesFromPayload,
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

  it("validates 42-char hex Ethereum addresses strictly", () => {
    expect(isValidEthAddress("0x379965158ff8a1762e5daefae48455aa21f7dfae")).toBe(true);
    expect(isValidEthAddress("0x1111111111111111111111111111111111111111")).toBe(true);
    expect(isValidEthAddress("not-an-address")).toBe(false);
    expect(isValidEthAddress("0x123")).toBe(false);
    expect(isValidEthAddress("")).toBe(false);
    expect(isValidEthAddress(null)).toBe(false);
  });

  it("extracts and deduplicates addresses from Redis leaderboard payloads", () => {
    const mockLeaderboard = [
      {
        address: "0x379965158ff8a1762e5daefae48455aa21f7dfae",
        score: 95,
        totalXP: 500,
      },
      {
        address: "0x2222222222222222222222222222222222222222",
        score: 80,
        totalXP: 400,
      },
      {
        // duplicate address with different capitalization
        address: "0X379965158FF8A1762E5DAEFAE48455AA21F7DFAE",
        score: 90,
        totalXP: 450,
      },
    ];

    const targetSet = new Set<string>();
    extractAddressesFromPayload(mockLeaderboard, targetSet);

    expect(targetSet.size).toBe(2);
    expect(targetSet.has("0x379965158ff8a1762e5daefae48455aa21f7dfae")).toBe(true);
    expect(targetSet.has("0x2222222222222222222222222222222222222222")).toBe(true);
  });

  it("extracts addresses from nested leaderboard containers and referrals", () => {
    const mockContainer = {
      entries: [
        { address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      ],
      referrals: {
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb": {
          invites: [
            "0xcccccccccccccccccccccccccccccccccccccccc",
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", // duplicate from entries
          ],
        },
      },
    };

    const targetSet = new Set<string>();
    extractAddressesFromPayload(mockContainer, targetSet);

    expect(targetSet.size).toBe(3);
    expect(targetSet.has("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(true);
    expect(targetSet.has("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")).toBe(true);
    expect(targetSet.has("0xcccccccccccccccccccccccccccccccccccccccc")).toBe(true);
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

  it("increments unique user count when a new distinct address connects", async () => {
    const uniqueAddr1 = "0x8888888888888888888888888888888888888888";
    const uniqueAddr2 = "0x9999999999999999999999999999999999999999";
    const count1 = await recordUniqueUser(uniqueAddr1);
    const count2 = await recordUniqueUser(uniqueAddr2);
    expect(count2).toBe(count1 + 1);
  });
});
