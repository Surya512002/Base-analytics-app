import { describe, expect, it, vi } from "vitest";
import { checkExit, describeExit } from "./exit-check";

/** A pool selling at $200 with a 0.3% fee, losing `perThousand`% of price for every $1,000 sold. */
const pool = (perThousand: number) => vi.fn(async (tokens: number) => tokens * 200 * 0.997 * (1 - ((tokens * 200) / 1000) * (perThousand / 100)));

describe("checkExit", () => {
  it("reports the largest size inside the limit and what the next one would cost", async () => {
    const quote = pool(0.2); // $5,000 → 1.0%, $25,000 → 5.0%
    const r = await checkExit(quote);
    expect(r).toMatchObject({ kind: "checked", okUsd: 5000, over: { usd: 25000 } });
    expect(describeExit(r, "NVDAc")).toBe("A sale of $5,000 moves the price 2% or less. Selling $25,000 would move it about 5.0%.");
    // probe + $100, $1,000, $5,000, $25,000: nothing is asked past the first failure
    expect(quote).toHaveBeenCalledTimes(5);
  });

  it("does not count the trading fee as price impact", async () => {
    expect(await checkExit(pool(0))).toEqual({ kind: "checked", okUsd: 1000000, over: null });
  });

  it("says when even the smallest sale is too big", async () => {
    const r = await checkExit(pool(40));
    expect(r).toMatchObject({ kind: "checked", okUsd: null, over: { usd: 100 } });
    expect(describeExit(r, "X")).toContain("Even a $100 sale is too big");
  });

  it("handles a stock with no route, and a size nobody can fill", async () => {
    expect(await checkExit(async () => null)).toEqual({ kind: "no-route" });
    const r = await checkExit(async (t) => (t * 200 > 2000 ? null : t * 200));
    expect(r).toEqual({ kind: "checked", okUsd: 1000, over: { usd: 5000, impactPct: null } });
    expect(describeExit(r, "X")).toContain("$5,000 can't be sold in one go.");
  });

  it("passes on a failed price read instead of calling it no route", async () => {
    await expect(checkExit(async () => Promise.reject(new Error("offline")))).rejects.toThrow("offline");
  });
});
