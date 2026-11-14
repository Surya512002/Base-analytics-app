import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import {
  getVerifiedTokenizedStocks,
  BASE_OFFICIAL_STOCKS,
  BASE_VERIFIED_STOCKS,
  isBaseVerifiedStockAddress,
  isBaseVerifiedStockSymbol,
} from "@/lib/stocks/base-verified";
import { getTokenizedStockBySymbol } from "@/lib/stocks/base-stocks";

describe("Base official (verified) stock list", () => {
  it("has every stock Base lists (358), all with valid checksummed, unique addresses", () => {
    expect(BASE_OFFICIAL_STOCKS).toHaveLength(358);
    for (const s of BASE_OFFICIAL_STOCKS) expect(getAddress(s.address)).toBe(s.address);
    expect(new Set(BASE_OFFICIAL_STOCKS.map((s) => s.address.toLowerCase())).size).toBe(358);
  });

  it("offers every official stock with 8 decimals, in Base's order", () => {
    expect(BASE_VERIFIED_STOCKS).toHaveLength(358);
    for (const s of BASE_VERIFIED_STOCKS) {
      expect(isBaseVerifiedStockAddress(s.address)).toBe(true);
      expect(s.decimals).toBe(8);
    }
    expect(BASE_VERIFIED_STOCKS.map((s) => s.symbol)).toEqual(BASE_OFFICIAL_STOCKS.map((s) => s.symbol));
  });

  it("includes AMD/Intel/Netflix/Palantir and rejects tokens Base does not list (COINc)", () => {
    for (const sym of ["AMDc", "INTCc", "NFLXc", "PLTRc"]) expect(isBaseVerifiedStockSymbol(sym)).toBe(true);
    for (const sym of ["COINc"]) {
      expect(isBaseVerifiedStockSymbol(sym)).toBe(false);
      const entry = getTokenizedStockBySymbol(sym);
      if (entry) expect(isBaseVerifiedStockAddress(entry.address)).toBe(false);
    }
    expect(isBaseVerifiedStockAddress("0x0000000000000000000000000000000000000001")).toBe(false);
    expect(isBaseVerifiedStockAddress(undefined)).toBe(false);
  });

  it("every official stock is in the app registry, so Launch and voucher checks see all 358", () => {
    const entries = getVerifiedTokenizedStocks();
    expect(entries).toHaveLength(358);
    for (const e of entries) {
      expect(e.status).toBe("active");
      expect(e.decimals).toBe(8);
      expect(e.issuer).toBe("Coinbase");
    }
    for (const sym of ["CSCOc", "BAc", "USARc", "ZSc"]) {
      expect(getTokenizedStockBySymbol(sym)?.symbol).toBe(sym);
    }
  });
});

describe("stocks Base added on 2026-11-14", () => {
  const added = ["ALLc", "AXPc", "EVERc", "FOURc", "GTc", "JBLUc", "OWLc", "UALc", "WUc", "YOUc"];

  it("are verified everywhere stocks are offered (launch pairs, vouchers, swap)", () => {
    for (const sym of added) {
      expect(isBaseVerifiedStockSymbol(sym), sym).toBe(true);
      const stock = BASE_VERIFIED_STOCKS.find((s) => s.symbol === sym);
      expect(stock, sym).toBeDefined();
      expect(isBaseVerifiedStockAddress(stock!.address), sym).toBe(true);
      expect(getTokenizedStockBySymbol(sym)?.address.toLowerCase(), sym).toBe(stock!.address.toLowerCase());
    }
  });
});
