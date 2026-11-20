import { describe, expect, it } from "vitest";
import { randomBytes } from "crypto";
import { decodeHistory, encodeHistory } from "@/lib/wallet/history-codec";

/** A history shaped like the real one: every hash in txHashes, and again in dayTxKeys with a day. */
function fakeHistory(txCount: number) {
  const txHashes = Array.from({ length: txCount }, () => `0x${randomBytes(32).toString("hex")}`);
  const day = (i: number) => `2026-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, "0")}`;
  return {
    historyComplete: true,
    txHashes,
    dayTxKeys: txHashes.map((h, i) => `${h}|${day(i)}`),
    tpd: Object.fromEntries(txHashes.slice(0, 200).map((_, i) => [day(i), i])),
    tokenAssets: ["0xabc", "0xdef"],
    updatedAt: 1,
  };
}

describe("wallet history codec", () => {
  it("round-trips exactly", () => {
    const h = fakeHistory(500);
    expect(decodeHistory(encodeHistory(h))).toEqual(h);
  });

  it("stores a busy wallet in about a third of the plain size or less", () => {
    const h = fakeHistory(20_000); // about 2.8 MB as JSON
    const plain = Buffer.byteLength(JSON.stringify(h));
    const packed = encodeHistory(h).length;
    expect(packed).toBeLessThan(plain / 2.5);
  });

  it("still reads entries written as plain JSON before the change", () => {
    const h = fakeHistory(50);
    expect(decodeHistory(Buffer.from(JSON.stringify(h)))).toEqual(h);
  });

  it("returns null for damaged data instead of throwing", () => {
    expect(decodeHistory(Buffer.from("WH1not-brotli"))).toBeNull();
    expect(decodeHistory(Buffer.from("{broken json"))).toBeNull();
  });
});
