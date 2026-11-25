import { describe, expect, it } from "vitest";
import { getBaseStockBySymbol } from "@/lib/stocks/base-stocks";
import { deriveStockMarketOptions } from "@/lib/lending/market-classifier";
import { classifyStockMarket, topLendingMarket } from "@/lib/lending/stock-market-groups";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";
import { priceText } from "@/src/lib/limitOrders/priceBasis";

const stock = getBaseStockBySymbol("NVDAc")!;
const market = (over: Record<string, unknown>): NormalizedMarket =>
  ({
    marketId: String(over.marketId),
    protocolLabel: String(over.protocol),
    contractAddress: "0x1111111111111111111111111111111111111111",
    borrowApr: null,
    liquidityUsd: 110_000,
    tvlUsd: 110_000,
    canSupply: true,
    canBorrow: false,
    canUseAsCollateral: false,
    riskFlags: [],
    status: "active",
    oracle: { name: "Chainlink", isVerified: true },
    ...over,
  }) as unknown as NormalizedMarket;

const vault = market({ marketId: "v", protocol: "beefy", type: "stake", supplyApy: 1251.86, supplyAsset: { address: "0x2222222222222222222222222222222222222222", symbol: "NVDAc-USDC", name: "vault", decimals: 18, isStock: false }, collateralAsset: { address: stock.address, symbol: "NVDAc", name: "NVIDIA", decimals: 8, isStock: true } });
const lend = market({ marketId: "l", protocol: "aave_v4", type: "lend", supplyApy: 2.1, supplyAsset: { address: stock.address, symbol: "NVDAc", name: "NVIDIA", decimals: 8, isStock: true } });

describe("headline lending rate", () => {
  it("never comes from a liquidity-pool vault, however large its number", () => {
    const s = deriveStockMarketOptions(stock, [vault, lend]);
    expect(s.bestLendOption?.supplyApy).toBe(2.1);
    expect(s.bestOverallYieldOption?.supplyApy).toBe(1251.86); // still listed, as a vault
  });
  it("is empty when a stock only has pool vaults", () => {
    expect(deriveStockMarketOptions(stock, [vault]).bestLendOption).toBeNull();
  });
});

describe("market panel headline", () => {
  const kinds = (list: NormalizedMarket[]) => list.map((m) => ({ ...m, kind: classifyStockMarket(m) }));
  it("skips pool vaults the same way", () => {
    expect(topLendingMarket(kinds([vault, lend]))?.supplyApy).toBe(2.1);
    expect(topLendingMarket(kinds([vault]))).toBeUndefined();
  });
});

describe("priceText", () => {
  it("shows cents from a dollar up and a few digits below it", () => {
    expect(priceText(15_203_644_218n)).toBe("152.04");
    expect(priceText(123_456_789_000n)).toBe("1,234.57");
    expect(priceText(100_000_000n)).toBe("1.00");
    expect(priceText(12_345_678n)).toBe("0.1235");
    expect(priceText(0n)).toBe("0.00");
  });
});
