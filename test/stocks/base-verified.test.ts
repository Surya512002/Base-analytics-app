import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import {
  getVerifiedTokenizedStocks,
  BASE_OFFICIAL_STOCKS,
  BASE_VERIFIED_STOCKS,
  isBaseVerifiedStockAddress,
  isBaseVerifiedStockSymbol,
} from "@/lib/stocks/base-verified";
import { BASE_OFFICIAL_REGISTRY } from "@/lib/stocks/base-official-registry";
import { COINBASE_LIVE_STOCKS } from "@/lib/stocks/live-stocks.generated";
import { getTokenizedStockBySymbol, isLiveStockAddress } from "@/lib/stocks/tokenized-stocks-registry";
import { ALL_BASE_STOCKS, BASE_STOCKS } from "@/lib/stocks/base-stocks";

describe("Base official stock list (base.org copy)", () => {
  it("mirrors every stock Base lists (358), with valid checksummed, unique addresses", () => {
    expect(BASE_OFFICIAL_REGISTRY).toHaveLength(358);
    for (const [, , address] of BASE_OFFICIAL_REGISTRY) expect(getAddress(address)).toBe(address);
    expect(new Set(BASE_OFFICIAL_REGISTRY.map(([, , a]) => a.toLowerCase())).size).toBe(358);
  });

  it("every Coinbase stock with tokens in circulation is on base.org's list", () => {
    const official = new Set(BASE_OFFICIAL_REGISTRY.map(([, , a]) => a.toLowerCase()));
    for (const [sym, , address] of COINBASE_LIVE_STOCKS) expect(official.has(address.toLowerCase()), sym).toBe(true);
  });
});

describe("stocks the app offers (Launch pairs, Vouchers, Swap, Lend)", () => {
  it("offers exactly the official stocks that are live, with 8 decimals, in Base's order", () => {
    expect(BASE_OFFICIAL_STOCKS.length).toBe(COINBASE_LIVE_STOCKS.length);
    expect(BASE_VERIFIED_STOCKS).toHaveLength(BASE_OFFICIAL_STOCKS.length);
    for (const s of BASE_VERIFIED_STOCKS) {
      expect(isBaseVerifiedStockAddress(s.address)).toBe(true);
      expect(isLiveStockAddress(s.address), s.symbol).toBe(true);
      expect(s.decimals).toBe(8);
    }
    expect(BASE_VERIFIED_STOCKS.map((s) => s.symbol)).toEqual(BASE_OFFICIAL_STOCKS.map((s) => s.symbol));
  });

  it("every offered stock is active in the registry, issued by Coinbase", () => {
    const entries = getVerifiedTokenizedStocks();
    expect(entries).toHaveLength(BASE_OFFICIAL_STOCKS.length);
    for (const e of entries) {
      expect(e.status).toBe("active");
      expect(e.decimals).toBe(8);
      expect(e.issuer).toBe("Coinbase");
    }
  });

  it("hides stocks that were never minted (zero supply), e.g. RKTc, and tokens Base does not list (COINc)", () => {
    for (const sym of ["RKTc", "COINc"]) {
      const entry = getTokenizedStockBySymbol(sym);
      expect(entry, sym).toBeDefined(); // still known by address, so lookups work
      expect(entry!.status, sym).not.toBe("active");
      expect(isLiveStockAddress(entry!.address), sym).toBe(false);
      expect(isBaseVerifiedStockSymbol(sym), sym).toBe(false);
      expect(BASE_STOCKS.some((s) => s.symbol === sym), sym).toBe(false);
      expect(ALL_BASE_STOCKS.some((s) => s.symbol === sym), sym).toBe(false);
    }
    expect(isBaseVerifiedStockAddress("0x0000000000000000000000000000000000000001")).toBe(false);
    expect(isBaseVerifiedStockAddress(undefined)).toBe(false);
  });

  it("keeps the big live stocks (NVIDIA, Apple, Tesla, AMD, Netflix)", () => {
    for (const sym of ["NVDAc", "AAPLc", "TSLAc", "AMDc", "NFLXc"]) {
      expect(isBaseVerifiedStockSymbol(sym), sym).toBe(true);
      expect(BASE_STOCKS.some((s) => s.symbol === sym), sym).toBe(true);
    }
  });
});
