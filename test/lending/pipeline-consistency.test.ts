import { describe, it, expect } from "vitest";
import { BASE_STOCKS, getBaseStockBySymbol } from "@/lib/stocks/base-stocks";
import { deriveStockMarketOptions } from "@/lib/lending/market-classifier";
import { getUnifiedStockLendingComparison } from "@/lib/lending/unified-comparison";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";
import { MIN_TVL_USD } from "@/lib/lending/constants";

describe("Lend & Stake Pipeline Consistency (Phase 1)", () => {
  // Test fixture markets simulating real discovered markets
  const mockMarkets: NormalizedMarket[] = [
    // 1. TSLAc Morpho Blue lend & borrow market
    {
      marketId: "morpho_tslac_usdc",
      protocol: "morpho",
      protocolLabel: "Morpho Blue",
      contractAddress: "0x1111111111111111111111111111111111111111",
      type: "borrow",
      supplyAsset: {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        isStock: false,
      },
      collateralAsset: {
        address: "0x12b32109F40847b2c58De15c0a359cfc6A763E4a",
        symbol: "TSLAc",
        name: "Tesla Inc",
        decimals: 8,
        isStock: true,
      },
      supplyApy: 7.5,
      borrowApr: 4.2,
      liquidityUsd: 250_000,
      tvlUsd: 600_000,
      maxLtv: 86,
      utilization: 60,
      oracle: { name: "Chainlink", isVerified: true },
      canSupply: true,
      canBorrow: true,
      canUseAsCollateral: true,
      riskFlags: [],
      sourceLink: "https://morpho.org",
      lastUpdated: "2026-03-01T00:00:00Z",
      status: "active",
    },
    // 2. GOOGLc Aerodrome DEX pool using alias "googc"
    {
      marketId: "aero_googc_usdc",
      protocol: "aerodrome",
      protocolLabel: "Aerodrome Finance",
      contractAddress: "0x2222222222222222222222222222222222222222",
      type: "stake",
      supplyAsset: {
        address: "0x3333333333333333333333333333333333333333",
        symbol: "googc-USDC-CL",
        name: "Aerodrome googc/USDC Pool",
        decimals: 18,
        isStock: false,
      },
      collateralAsset: {
        address: "0x2055DEb59f33b1bC6f4B4731F2E0bb063678F567",
        symbol: "googc",
        name: "Alphabet Inc",
        decimals: 8,
        isStock: true,
      },
      supplyApy: 18.4,
      liquidityUsd: 120_000,
      tvlUsd: 150_000,
      maxLtv: 0,
      utilization: 0,
      oracle: { name: "Aerodrome TWAP", isVerified: true },
      canSupply: true,
      canBorrow: false,
      canUseAsCollateral: false,
      riskFlags: [],
      sourceLink: "https://aerodrome.finance",
      lastUpdated: "2026-03-01T00:00:00Z",
      status: "active",
    },
    // 3. SPCXc Pure Stock Lend Market (real lending of SPCXc)
    {
      marketId: "morpho_spcx_lend",
      protocol: "morpho",
      protocolLabel: "Morpho Blue",
      contractAddress: "0x4444444444444444444444444444444444444444",
      type: "lend",
      supplyAsset: {
        address: "0xF7205eb50ca944d187B0b9c5d01Fa8D1E6167Fa4",
        symbol: "SPCXc",
        name: "SpaceX Tracking",
        decimals: 8,
        isStock: true,
      },
      supplyApy: 3.2,
      liquidityUsd: 45_000,
      tvlUsd: 80_000,
      maxLtv: 0,
      utilization: 0,
      oracle: { name: "Chainlink", isVerified: true },
      canSupply: true,
      canBorrow: false,
      canUseAsCollateral: false,
      riskFlags: [],
      sourceLink: "https://morpho.org",
      lastUpdated: "2026-03-01T00:00:00Z",
      status: "active",
    },
    // 4. Low Liquidity $2 vault for SKHYc (Must be flagged low liquidity and excluded from best yield)
    {
      marketId: "beefy_skhyc_low_liq",
      protocol: "beefy",
      protocolLabel: "Beefy Finance",
      contractAddress: "0x5555555555555555555555555555555555555555",
      type: "stake",
      supplyAsset: {
        address: "0x6666666666666666666666666666666666666666",
        symbol: "mooSKHYc-USDC",
        name: "Beefy SKHYc-USDC Vault",
        decimals: 18,
        isStock: false,
      },
      collateralAsset: {
        address: "0xB20320427e040c5f242C648EeaAeab3b72390f77",
        symbol: "SKHYc",
        name: "SK Hynix",
        decimals: 8,
        isStock: true,
      },
      supplyApy: 225.0,
      liquidityUsd: 2.5, // Well below MIN_TVL_USD (5000)
      tvlUsd: 2.5,
      maxLtv: 0,
      utilization: 0,
      oracle: { name: "Beefy", isVerified: true },
      canSupply: true,
      canBorrow: false,
      canUseAsCollateral: false,
      riskFlags: [],
      sourceLink: "https://beefy.finance",
      lastUpdated: "2026-03-01T00:00:00Z",
      status: "active",
    },
    // 5. Dinari Stock market for dBITX
    {
      marketId: "dinari_dbitx_market",
      protocol: "morpho",
      protocolLabel: "Morpho Blue",
      contractAddress: "0x7777777777777777777777777777777777777777",
      type: "borrow",
      supplyAsset: {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        isStock: false,
      },
      collateralAsset: {
        address: "0x759604aC3306637e192f153a812D328B62f1c1fB",
        symbol: "dBITX",
        name: "Dinari BITX",
        decimals: 18,
        isStock: true,
      },
      supplyApy: 6.0,
      borrowApr: 5.5,
      liquidityUsd: 80_000,
      tvlUsd: 100_000,
      maxLtv: 75,
      utilization: 45,
      oracle: { name: "Chainlink", isVerified: true },
      canSupply: true,
      canBorrow: true,
      canUseAsCollateral: true,
      riskFlags: [],
      sourceLink: "https://morpho.org",
      lastUpdated: "2026-03-01T00:00:00Z",
      status: "active",
    },
  ];

  it("ensures MIN_TVL_USD constant is set to 5000", () => {
    expect(MIN_TVL_USD).toBe(5000);
  });

  it("excludes low liquidity vaults (< $5,000) from best supply yield ranking", () => {
    const skhyStock = getBaseStockBySymbol("SKHYc");
    expect(skhyStock).toBeDefined();
    if (!skhyStock) return;

    const summary = deriveStockMarketOptions(skhyStock, mockMarkets);
    expect(summary.options.length).toBe(1);
    expect(summary.options[0].isLowLiquidity).toBe(true);
    // Best overall yield option should NOT pick the 225% yield on $2.5
    expect(summary.bestOverallYieldOption).toBeNull();
    expect(summary.bestLpOption).toBeNull();
  });

  it("strictly matches TSLAc table summary with detail view comparison", async () => {
    const tslaStock = getBaseStockBySymbol("TSLAc");
    expect(tslaStock).toBeDefined();
    if (!tslaStock) return;

    // 1. Compute table summary
    const tableSummary = deriveStockMarketOptions(tslaStock, mockMarkets);

    // 2. Compute detail view comparison passing the exact same mockMarkets
    const detailComparison = await getUnifiedStockLendingComparison(
      "TSLAc",
      undefined,
      false,
      mockMarkets
    );

    // Check borrow APR matches exactly
    expect(tableSummary.bestBorrowOption?.borrowApr).toBe(4.2);
    expect(detailComparison.bestBorrowOption?.borrowApr).toBe(4.2);
    expect(tableSummary.bestBorrowOption?.protocolLabel).toBe("Morpho Blue");
    expect(detailComparison.bestBorrowOption?.protocolName).toBe("Morpho Blue");

    // Collateral-only borrow market must NOT count as stock supply APY
    expect(tableSummary.bestLendOption).toBeNull();
    expect(detailComparison.bestSupplyOption).toBeNull();
  });

  it("resolves symbol aliases correctly for GOOGLc <-> googc", async () => {
    const googStock = getBaseStockBySymbol("GOOGLc");
    expect(googStock).toBeDefined();
    if (!googStock) return;

    const summary = deriveStockMarketOptions(googStock, mockMarkets);
    expect(summary.options.length).toBe(1);
    expect(summary.options[0].role).toBe("lp_vault");
    expect(summary.options[0].kindChip).toBe("DEX LP");
    expect(summary.bestOverallYieldOption?.supplyApy).toBe(18.4);

    const detailComparison = await getUnifiedStockLendingComparison(
      "GOOGLc",
      undefined,
      false,
      mockMarkets
    );
    expect(detailComparison.bestSupplyOption?.supplyApy).toBe(18.4);
    expect(detailComparison.bestSupplyOption?.protocolName).toBe("Aerodrome Finance");
  });

  it("distinguishes pure stock lending from collateral-only borrowing for SPCXc", async () => {
    const spcxStock = getBaseStockBySymbol("SPCXc");
    expect(spcxStock).toBeDefined();
    if (!spcxStock) return;

    const summary = deriveStockMarketOptions(spcxStock, mockMarkets);
    expect(summary.bestLendOption?.supplyApy).toBe(3.2);
    expect(summary.bestLendOption?.role).toBe("lend");
    expect(summary.bestLendOption?.kindChip).toBe("Lend");

    const detailComparison = await getUnifiedStockLendingComparison(
      "SPCXc",
      undefined,
      false,
      mockMarkets
    );
    expect(detailComparison.bestSupplyOption?.supplyApy).toBe(3.2);
    expect(detailComparison.bestSupplyOption?.kindChip).toBe("Lend");
  });

  it("handles Dinari stocks without defaulting to NVDAc", async () => {
    const dbitxStock = getBaseStockBySymbol("dBITX");
    expect(dbitxStock).toBeDefined();
    expect(dbitxStock?.symbol).toBe("dBITX");
    expect(dbitxStock?.symbol).not.toBe("NVDAc");

    // Also verify non-existent stock returns null, not NVDAc
    const nonExistent = getBaseStockBySymbol("NON_EXISTENT_TICKER");
    expect(nonExistent).toBeNull();
  });

  it("guarantees 100% agreement between table and detail view for every stock in BASE_STOCKS", async () => {
    for (const stock of BASE_STOCKS) {
      const tableSummary = deriveStockMarketOptions(stock, mockMarkets);
      const detailComparison = await getUnifiedStockLendingComparison(
        stock.symbol,
        undefined,
        false,
        mockMarkets
      );

      // Verify options count matches
      expect(tableSummary.options.length).toBe(detailComparison.options.length);

      // Verify best yield matches
      const tableBestYield = tableSummary.bestOverallYieldOption?.supplyApy ?? 0;
      const detailBestYield = detailComparison.bestSupplyOption?.supplyApy ?? 0;
      expect(tableBestYield).toBe(detailBestYield);

      // Verify best borrow APR matches
      const tableBestBorrow = tableSummary.bestBorrowOption?.borrowApr ?? null;
      const detailBestBorrow = detailComparison.bestBorrowOption?.borrowApr ?? null;
      expect(tableBestBorrow).toBe(detailBestBorrow);

      // Verify total liquidity matches
      expect(Math.round(tableSummary.totalLiquidityUsd)).toBe(
        Math.round(detailComparison.totalLiquidityUsd ?? 0)
      );
    }
  });
});
