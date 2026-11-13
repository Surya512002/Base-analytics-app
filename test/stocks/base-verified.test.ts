import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import {
  BASE_OFFICIAL_STOCKS,
  BASE_VERIFIED_STOCKS,
  isBaseVerifiedStockAddress,
  isBaseVerifiedStockSymbol,
} from "@/lib/stocks/base-verified";
import { getTokenizedStockBySymbol } from "@/lib/stocks/base-stocks";

describe("Base official (verified) stock list", () => {
  it("has exactly the 10 stocks Base lists, all with valid checksummed addresses", () => {
    expect(BASE_OFFICIAL_STOCKS).toHaveLength(10);
    for (const s of BASE_OFFICIAL_STOCKS) expect(getAddress(s.address)).toBe(s.address);
    expect(new Set(BASE_OFFICIAL_STOCKS.map((s) => s.address.toLowerCase())).size).toBe(10);
  });

  it("every official stock is in the app registry, active, 8 decimals, same address", () => {
    expect(BASE_VERIFIED_STOCKS).toHaveLength(10);
    for (const s of BASE_VERIFIED_STOCKS) {
      expect(isBaseVerifiedStockAddress(s.address)).toBe(true);
      expect(s.decimals).toBe(8);
    }
    expect(BASE_VERIFIED_STOCKS.map((s) => s.symbol)).toEqual(BASE_OFFICIAL_STOCKS.map((s) => s.symbol));
  });

  it("rejects registry tokens Base does not list", () => {
    for (const sym of ["COINc", "PLTRc", "INTCc", "NFLXc"]) {
      expect(isBaseVerifiedStockSymbol(sym)).toBe(false);
      const entry = getTokenizedStockBySymbol(sym);
      if (entry) expect(isBaseVerifiedStockAddress(entry.address)).toBe(false);
    }
    expect(isBaseVerifiedStockAddress("0x0000000000000000000000000000000000000001")).toBe(false);
    expect(isBaseVerifiedStockAddress(undefined)).toBe(false);
  });
});
