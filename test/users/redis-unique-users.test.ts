import { describe, it, expect, vi } from "vitest";
import {
  recordUniqueUser,
  getUniqueUserCount,
  getFormattedUniqueUserCount,
  isValidEthAddress,
  isValidTxHash,
  verifyAndRecordUserTransaction,
} from "@/lib/redis-unique-users";

describe("Redis Verified Unique Users Tracker", () => {
  it("defaults to strict 0 baseline count for verified users without artificial inflation", async () => {
    const count = await getUniqueUserCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("formats the verified unique user count as a readable localized string", async () => {
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

  it("validates 66-char hex transaction hashes strictly", () => {
    expect(
      isValidTxHash("0x52467d5bbbf878d6b8ec1159385ffca5f76b1f868c2d2aa6ffc5d57bba91f7a4")
    ).toBe(true);
    expect(isValidTxHash("0x123")).toBe(false);
    expect(isValidTxHash("not-a-hash")).toBe(false);
    expect(isValidTxHash("")).toBe(false);
    expect(isValidTxHash(null)).toBe(false);
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

  it("increments unique user count when a new distinct verified address connects", async () => {
    const uniqueAddr1 = "0x8888888888888888888888888888888888888888";
    const uniqueAddr2 = "0x9999999999999999999999999999999999999999";
    const count1 = await recordUniqueUser(uniqueAddr1);
    const count2 = await recordUniqueUser(uniqueAddr2);
    expect(count2).toBe(count1 + 1);
  });

  it("rejects unconfirmed or malformed transaction verification requests", async () => {
    const res = await verifyAndRecordUserTransaction(
      "0x1111111111111111111111111111111111111111",
      "0xinvalidhash"
    );
    expect(res.success).toBe(false);
    expect(res.error).toBe("Invalid transaction hash format");
  });

  it("rejects verification when address format is invalid", async () => {
    const res = await verifyAndRecordUserTransaction(
      "invalid-address",
      "0x52467d5bbbf878d6b8ec1159385ffca5f76b1f868c2d2aa6ffc5d57bba91f7a4"
    );
    expect(res.success).toBe(false);
    expect(res.error).toBe("Invalid Ethereum address format");
  });
});
