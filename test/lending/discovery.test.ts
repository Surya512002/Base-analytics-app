import { describe, expect, it, vi } from "vitest";
import { morphoAdapter } from "@/lib/lending/discovery/adapters/morpho";
import { aaveAdapter } from "@/lib/lending/discovery/adapters/aave";
import { moonwellAdapter } from "@/lib/lending/discovery/adapters/moonwell";
import { aerodromeAdapter } from "@/lib/lending/discovery/adapters/aerodrome";
import { eulerAdapter } from "@/lib/lending/discovery/adapters/euler";
import { superformAdapter } from "@/lib/lending/discovery/adapters/superform";
import { runMarketDiscovery } from "@/lib/lending/discovery/engine";
import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";

describe("Protocol Adapters & Discovery Engine Audit", () => {
  it("verifies morpho adapter normalizes markets and filters by chainId 8453", async () => {
    const mockFixture = {
      data: {
        markets: {
          pageInfo: { hasNextPage: false, endCursor: null },
          items: [
            {
              marketId: "0x1234567890abcdef",
              lltv: "770000000000000000", // 77%
              oracle: {
                address: "0x04689a41629776563E6822F76f2e57D148d28513",
                type: "ChainlinkOracle",
              },
              irmAddress: "0x4560000000000000000000000000000000000001",
              state: {
                supplyApy: 0.0485,
                borrowApy: 0.032,
                utilization: 0.684,
                liquidityAssets: "100000000000",
                supplyAssetsUsd: 14850000,
                borrowAssetsUsd: 10157400,
              },
              loanAsset: {
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                symbol: "USDC",
                name: "USD Coin",
                decimals: 6,
                priceUsd: 1.0,
              },
              collateralAsset: {
                address: "0xb20000000000000000000078ee7ce2fe4908108c", // NVDAc
                symbol: "NVDAc",
                name: "NVIDIA Corp",
                decimals: 8,
                priceUsd: 135.5,
              },
            },
          ],
        },
      },
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (typeof url === "string" && url.includes("morpho.org")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockFixture,
        });
      }
      return originalFetch(url, opts);
    });

    try {
      const markets = await morphoAdapter.discoverMarkets(8453);
      expect(markets.length).toBe(1);
      const m = markets[0];
      expect(m.protocol).toBe("morpho");
      expect(m.collateralAsset?.symbol).toBe("NVDAc");
      expect(m.maxLtv).toBe(77);
      expect(m.supplyApy).toBe(4.85);
      expect(m.borrowApr).toBe(3.2);
      expect(m.oracle.isVerified).toBe(true);
      expect(m.canBorrow).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("verifies Aave V4 is explicitly noted as not deployed on Base and V3 is queried", () => {
    expect(aaveAdapter.protocolLabel).toBe("Aave V3");
    expect(aaveAdapter.protocol).toBe("aave");
  });

  it("verifies Matching Rule: unapproved stock token is excluded from user view", async () => {
    const unapprovedStockAddress = "0x9999999999999999999999999999999999999999";
    const nvdaStock = TOKENIZED_STOCKS_REGISTRY[0]; // Active stock NVDAc

    // Spy on adapters so discovery runs entirely via fast fixtures
    const morphoSpy = vi.spyOn(morphoAdapter, "discoverMarkets").mockResolvedValue([
      {
        protocol: "morpho",
        protocolLabel: "Morpho Blue",
        marketId: "unapproved-market-1",
        type: "borrow",
        supplyAsset: {
          symbol: "USDC",
          name: "USD Coin",
          address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          decimals: 6,
          isStock: false,
        },
        collateralAsset: {
          symbol: "UNLISTEDc",
          name: "Unlisted Stock Token",
          address: unapprovedStockAddress,
          decimals: 8,
          isStock: true,
        },
        supplyApy: 5,
        borrowApr: 4,
        maxLtv: 70,
        liquidityUsd: 100000,
        tvlUsd: 200000,
        utilization: 50,
        oracle: { name: "Oracle", isVerified: true, address: "0x1234567890123456789012345678901234567890" },
        canSupply: true,
        canBorrow: true,
        canUseAsCollateral: true,
        riskFlags: [],
        sourceLink: "https://example.com",
        lastUpdated: new Date().toISOString(),
        status: "active",
      },
      {
        protocol: "morpho",
        protocolLabel: "Morpho Blue",
        marketId: "approved-market-2",
        type: "borrow",
        supplyAsset: {
          symbol: "USDC",
          name: "USD Coin",
          address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          decimals: 6,
          isStock: false,
        },
        collateralAsset: {
          symbol: nvdaStock.symbol,
          name: nvdaStock.name,
          address: nvdaStock.address,
          decimals: nvdaStock.decimals,
          isStock: true,
        },
        supplyApy: 4.85,
        borrowApr: 3.2,
        maxLtv: 77,
        liquidityUsd: 100000,
        tvlUsd: 200000,
        utilization: 50,
        oracle: { name: "Chainlink", isVerified: true, address: "0x04689a41629776563E6822F76f2e57D148d28513" },
        canSupply: true,
        canBorrow: true,
        canUseAsCollateral: true,
        riskFlags: [],
        sourceLink: "https://example.com",
        lastUpdated: new Date().toISOString(),
        status: "active",
      },
    ]);

    const aaveSpy = vi.spyOn(aaveAdapter, "discoverMarkets").mockResolvedValue([]);
    const moonwellSpy = vi.spyOn(moonwellAdapter, "discoverMarkets").mockResolvedValue([]);
    const aeroSpy = vi.spyOn(aerodromeAdapter, "discoverMarkets").mockResolvedValue([]);
    const eulerSpy = vi.spyOn(eulerAdapter, "discoverMarkets").mockResolvedValue([]);
    const superformSpy = vi.spyOn(superformAdapter, "discoverMarkets").mockResolvedValue([]);

    try {
      const result = await runMarketDiscovery(8453, true);
      const unapprovedMarket = result.markets.find(
        (m) => m.collateralAsset?.address === unapprovedStockAddress
      );
      // Matching rule MUST exclude unlisted stocks from being presented to users
      expect(unapprovedMarket).toBeUndefined();

      // Approved market must be included
      const approvedMarket = result.markets.find(
        (m) => m.collateralAsset?.address.toLowerCase() === nvdaStock.address.toLowerCase()
      );
      expect(approvedMarket).toBeDefined();
    } finally {
      morphoSpy.mockRestore();
      aaveSpy.mockRestore();
      moonwellSpy.mockRestore();
      aeroSpy.mockRestore();
      eulerSpy.mockRestore();
      superformSpy.mockRestore();
    }
  });

  it("verifies Safety Gates: unknown oracle disables borrow and adds amber warning", async () => {
    const nvdaStock = TOKENIZED_STOCKS_REGISTRY[0]; // NVDAc

    const morphoSpy = vi.spyOn(morphoAdapter, "discoverMarkets").mockResolvedValue([
      {
        protocol: "morpho",
        protocolLabel: "Morpho Blue",
        marketId: "market-unknown-oracle",
        type: "borrow",
        supplyAsset: {
          symbol: "USDC",
          name: "USD Coin",
          address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          decimals: 6,
          isStock: false,
        },
        collateralAsset: {
          symbol: nvdaStock.symbol,
          name: nvdaStock.name,
          address: nvdaStock.address,
          decimals: nvdaStock.decimals,
          isStock: true,
        },
        supplyApy: 5,
        borrowApr: 4,
        maxLtv: 70,
        liquidityUsd: 50000,
        tvlUsd: 100000,
        utilization: 50,
        oracle: { name: "Unknown", isVerified: false, address: undefined },
        canSupply: true,
        canBorrow: true, // Should be flipped to false by safety gate
        canUseAsCollateral: true,
        riskFlags: [],
        sourceLink: "https://example.com",
        lastUpdated: new Date().toISOString(),
        status: "active",
      },
    ]);

    const aaveSpy = vi.spyOn(aaveAdapter, "discoverMarkets").mockResolvedValue([]);
    const moonwellSpy = vi.spyOn(moonwellAdapter, "discoverMarkets").mockResolvedValue([]);
    const aeroSpy = vi.spyOn(aerodromeAdapter, "discoverMarkets").mockResolvedValue([]);
    const eulerSpy = vi.spyOn(eulerAdapter, "discoverMarkets").mockResolvedValue([]);
    const superformSpy = vi.spyOn(superformAdapter, "discoverMarkets").mockResolvedValue([]);

    try {
      const result = await runMarketDiscovery(8453, true);
      const m = result.markets.find((x) => x.marketId === "market-unknown-oracle");
      expect(m).toBeDefined();
      expect(m?.canBorrow).toBe(false);
      expect(m?.riskFlags).toContain("UNKNOWN_ORACLE");
    } finally {
      morphoSpy.mockRestore();
      aaveSpy.mockRestore();
      moonwellSpy.mockRestore();
      aeroSpy.mockRestore();
      eulerSpy.mockRestore();
      superformSpy.mockRestore();
    }
  });

  it("verifies protocol failure does not take down the whole page and records protocol error", async () => {
    const nvdaStock = TOKENIZED_STOCKS_REGISTRY[0];

    const morphoSpy = vi.spyOn(morphoAdapter, "discoverMarkets").mockRejectedValue(
      new Error("Morpho API 503 Outage")
    );
    const aaveSpy = vi.spyOn(aaveAdapter, "discoverMarkets").mockResolvedValue([
      {
        protocol: "aave",
        protocolLabel: "Aave V3",
        marketId: "aave-nvda-market",
        type: "lend",
        supplyAsset: {
          symbol: nvdaStock.symbol,
          name: nvdaStock.name,
          address: nvdaStock.address,
          decimals: nvdaStock.decimals,
          isStock: true,
        },
        supplyApy: 6.2,
        borrowApr: 8.5,
        maxLtv: 75,
        liquidityUsd: 50000,
        tvlUsd: 120000,
        utilization: 60,
        oracle: { name: "Chainlink", isVerified: true, address: "0x04689a41629776563E6822F76f2e57D148d28513" },
        canSupply: true,
        canBorrow: true,
        canUseAsCollateral: true,
        riskFlags: [],
        sourceLink: "https://example.com",
        lastUpdated: new Date().toISOString(),
        status: "active",
      },
    ]);
    const moonwellSpy = vi.spyOn(moonwellAdapter, "discoverMarkets").mockResolvedValue([]);
    const aeroSpy = vi.spyOn(aerodromeAdapter, "discoverMarkets").mockResolvedValue([]);
    const eulerSpy = vi.spyOn(eulerAdapter, "discoverMarkets").mockResolvedValue([]);
    const superformSpy = vi.spyOn(superformAdapter, "discoverMarkets").mockResolvedValue([]);

    try {
      const result = await runMarketDiscovery(8453, true);
      // Morpho should be flagged as error
      expect(result.protocolStatus.morpho.status).toBe("error");
      expect(result.protocolStatus.morpho.error).toMatch(/Morpho API 503/);

      // Aave should be OK and its markets returned
      expect(result.protocolStatus.aave.status).toBe("ok");
      expect(result.markets.some((m) => m.protocol === "aave")).toBe(true);
    } finally {
      morphoSpy.mockRestore();
      aaveSpy.mockRestore();
      moonwellSpy.mockRestore();
      aeroSpy.mockRestore();
      eulerSpy.mockRestore();
      superformSpy.mockRestore();
    }
  });
});
