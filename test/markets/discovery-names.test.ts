import { describe, expect, it } from "vitest";
import { pairToExternalToken } from "@/lib/launchpad/external-discovery";
import type { DexScreenerPair } from "@/lib/launchpad/dexscreener";
import { borrowedNameFilter } from "@/lib/markets/known-names";
import type { MarketItem } from "@/lib/markets/board";

const AERO = "0x940181a94a35a4569e4529a3cdfb74e38fd98631";
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const pair = {
  chainId: "base",
  baseToken: { address: AERO, symbol: "AERO", name: "Aerodrome" },
  quoteToken: { address: USDC, symbol: "USDC", name: "USD Coin" },
} as unknown as DexScreenerPair;
const market = { hasPool: true, liquidityUsd: 1_000_000 } as never;

describe("discovered token names", () => {
  it("names a token after its own side of the pool", () => {
    expect(pairToExternalToken(AERO, pair, market)?.symbol).toBe("AERO");
    expect(pairToExternalToken(USDC, pair, market)?.symbol).toBe("USDC");
  });

  it("skips a pool that does not contain the token", () => {
    expect(pairToExternalToken("0x1111111111111111111111111111111111111111", pair, market)).toBeNull();
  });
});

describe("market list names", () => {
  it("shows verified names, drops look-alikes and leaves USDC out", () => {
    const seen: string[] = [];
    const add = borrowedNameFilter(["NVDAc"], (x) => seen.push(x.symbol));
    const item = (symbol: string, address: string, kind: MarketItem["kind"] = "token") => ({ symbol, address, kind, name: symbol, decimals: 18 }) as MarketItem;
    add(item("NVDAc", "0xb200000000000000000000000000000000000001", "stock"));
    add(item("AERO", AERO));
    add(item("aero", "0x1111111111111111111111111111111111111111"));
    add(item("NVDAC", "0x2222222222222222222222222222222222222222", "launched"));
    add(item("USDC", USDC));
    add(item("NEWONE", "0x3333333333333333333333333333333333333333"));
    expect(seen).toEqual(["NVDAc", "AERO", "NEWONE"]);
  });
});
