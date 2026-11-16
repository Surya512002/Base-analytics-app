import { describe, expect, it } from "vitest";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";
import { BASE_LENDING_MARKETS } from "@/lib/lending/markets";
import { isPairMarket, pairStockSymbol, resolvePairVault } from "./pair-route";

const byId = (id: string) => {
  const m = BASE_LENDING_MARKETS.find((x) => x.id === id);
  if (!m) throw new Error(`missing market ${id}`);
  return m;
};

const beefyLp = (over: Partial<NormalizedMarket>): NormalizedMarket =>
  ({
    protocol: "beefy",
    type: "supply",
    supplyAsset: { symbol: "NVDAc-USDC", address: "0x0000000000000000000000000000000000000001", decimals: 18 },
    collateralAsset: { symbol: "NVDAc", address: "0x0000000000000000000000000000000000000002", decimals: 8 },
    supplyApy: 6,
    tvlUsd: 1000,
    liquidityUsd: 0,
    canSupply: true,
    sourceLink: "https://app.beefy.com",
    contractAddress: "0x00000000000000000000000000000000000000aa",
    ...over,
  }) as unknown as NormalizedMarket;

describe("pairStockSymbol", () => {
  it("finds the stock side of a pair in any order or notation", () => {
    expect(pairStockSymbol("NVDAc-USDC")).toBe("NVDAc");
    expect(pairStockSymbol("USDC/AAPLc")).toBe("AAPLc");
    expect(pairStockSymbol("vAMM-METAc/WETH")).toBe("METAc");
  });
  it("returns null for single tokens and quote-only pairs", () => {
    expect(pairStockSymbol("NVDAc")).toBeNull();
    expect(pairStockSymbol("USDC")).toBeNull();
    expect(pairStockSymbol("WETH-USDC")).toBeNull();
  });
});

describe("resolvePairVault", () => {
  it("uses a Beefy pair vault directly", () => {
    const m = byId("stock-lend-nvda");
    expect(isPairMarket(m)).toBe(true);
    const r = resolvePairVault(m, [], BASE_LENDING_MARKETS);
    expect(r).toMatchObject({ vault: m.contractAddress, stockSymbol: "NVDAc", viaStockVault: false });
  });

  it("without a catalog match, uses the stock's deepest live Beefy vault", () => {
    const shallow = beefyLp({ tvlUsd: 10, contractAddress: "0x00000000000000000000000000000000000000b1" });
    const deep = beefyLp({ tvlUsd: 9_000, contractAddress: "0x00000000000000000000000000000000000000b2" });
    const paused = beefyLp({ tvlUsd: 99_000, canSupply: false, contractAddress: "0x00000000000000000000000000000000000000b3" });
    const r = resolvePairVault(byId("aero-nvdac-usdc"), [shallow, deep, paused], []);
    expect(r).toMatchObject({ vault: deep.contractAddress, stockSymbol: "NVDAc", viaStockVault: true });
  });

  it("hands a CoW pool to the catalog Beefy vault that wraps it", () => {
    const r = resolvePairVault(byId("aero-aaplc-usdc"), [], BASE_LENDING_MARKETS);
    expect(r).toMatchObject({ vault: byId("beefy-aaplc-usdc").contractAddress, viaStockVault: true });
  });

  it("ignores single-token markets", () => {
    const single = BASE_LENDING_MARKETS.find((m) => !isPairMarket(m));
    if (single) expect(resolvePairVault(single, [beefyLp({})], BASE_LENDING_MARKETS)).toBeNull();
  });
});
