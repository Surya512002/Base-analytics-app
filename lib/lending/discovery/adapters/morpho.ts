import { getAddress, type Address } from "viem";
import type { DiscoveryAdapter, NormalizedMarket } from "../types";
import { MORPHO_BLUE_BASE } from "@/lib/lending/constants";
import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";

const MORPHO_GRAPHQL_ENDPOINT = "https://blue-api.morpho.org/graphql";

const STOCK_MARKETS_QUERY = `
  query GetBaseMorphoStockMarkets($chainId: Int!, $collateralAddrs: [String!]) {
    markets(
      first: 100
      where: {
        chainId_in: [$chainId]
        collateralAssetAddress_in: $collateralAddrs
      }
    ) {
      items {
        marketId
        lltv
        irmAddress
        oracle {
          address
          type
        }
        state {
          supplyApy
          borrowApy
          utilization
          liquidityAssets
          supplyAssetsUsd
          borrowAssetsUsd
        }
        loanAsset {
          address
          symbol
          name
          decimals
          priceUsd
        }
        collateralAsset {
          address
          symbol
          name
          decimals
          priceUsd
        }
      }
    }
  }
`;

const GENERAL_MARKETS_QUERY = `
  query GetBaseMorphoGeneralMarkets($chainId: Int!, $first: Int!) {
    markets(
      first: $first
      where: { chainId_in: [$chainId] }
      orderBy: SupplyAssetsUsd
      orderDirection: Desc
    ) {
      items {
        marketId
        lltv
        irmAddress
        oracle {
          address
          type
        }
        state {
          supplyApy
          borrowApy
          utilization
          liquidityAssets
          supplyAssetsUsd
          borrowAssetsUsd
        }
        loanAsset {
          address
          symbol
          name
          decimals
          priceUsd
        }
        collateralAsset {
          address
          symbol
          name
          decimals
          priceUsd
        }
      }
    }
  }
`;

export const morphoAdapter: DiscoveryAdapter = {
  protocol: "morpho",
  protocolLabel: "Morpho Blue",
  async discoverMarkets(chainId: number): Promise<NormalizedMarket[]> {
    const markets: NormalizedMarket[] = [];
    const seenMarketIds = new Set<string>();

    try {
      const rawItems: any[] = [];

      // 1. Fetch tokenized stock markets by chunking active tokenized stock addresses (50 per chunk)
      const stockAddrs = TOKENIZED_STOCKS_REGISTRY.map((s) => s.address);
      const chunkSize = 50;
      const chunks: string[][] = [];
      for (let i = 0; i < stockAddrs.length; i += chunkSize) {
        chunks.push(stockAddrs.slice(i, i + chunkSize));
      }

      await Promise.all(
        chunks.map(async (chunk) => {
          try {
            const resp = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: STOCK_MARKETS_QUERY,
                variables: {
                  chainId,
                  collateralAddrs: chunk,
                },
              }),
              next: { revalidate: 300 },
            });
            if (resp.ok) {
              const json = await resp.json();
              const items = json.data?.markets?.items;
              if (Array.isArray(items)) {
                rawItems.push(...items);
              }
            }
          } catch (chunkErr) {
            console.warn("[Morpho Discovery] Stock chunk query failed:", chunkErr);
          }
        })
      );

      // 2. Fetch top general Base markets (ordered by SupplyAssetsUsd desc)
      try {
        const resp = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: GENERAL_MARKETS_QUERY,
            variables: {
              chainId,
              first: 100,
            },
          }),
          next: { revalidate: 300 },
        });
        if (resp.ok) {
          const json = await resp.json();
          const items = json.data?.markets?.items;
          if (Array.isArray(items)) {
            rawItems.push(...items);
          }
        }
      } catch (genErr) {
        console.warn("[Morpho Discovery] General markets query failed:", genErr);
      }

      for (const item of rawItems) {
        if (!item.collateralAsset || !item.loanAsset) continue;

        try {
          const loanAddr = getAddress(item.loanAsset.address);
          const colAddr = getAddress(item.collateralAsset.address);
          const marketKey = item.marketId || `morpho-${colAddr.slice(0, 8)}-${loanAddr.slice(0, 8)}`;
          if (seenMarketIds.has(marketKey.toLowerCase())) continue;
          seenMarketIds.add(marketKey.toLowerCase());

          const oracleAddr = item.oracle?.address ? getAddress(item.oracle.address) : undefined;
          const irmAddr = item.irmAddress ? getAddress(item.irmAddress) : undefined;

          const lltvNum = item.lltv ? Number(BigInt(item.lltv)) / 1e18 : 0;
          const ltvPct = Math.round(lltvNum * 100);

          const supplyAssetsUsd = Number(item.state?.supplyAssetsUsd || 0);
          const borrowAssetsUsd = Number(item.state?.borrowAssetsUsd || 0);
          const tvlUsd = Math.round(supplyAssetsUsd + borrowAssetsUsd);
          const liquidityUsd = Math.max(0, supplyAssetsUsd - borrowAssetsUsd);

          const supplyApy = Number((item.state?.supplyApy || 0) * 100);
          const borrowApr = Number((item.state?.borrowApy || 0) * 100);
          const utilization = Number((item.state?.utilization || 0) * 100);

          const isKnownOracle = oracleAddr !== undefined && oracleAddr !== "0x0000000000000000000000000000000000000000";

          markets.push({
            protocol: "morpho",
            protocolLabel: "Morpho Blue",
            marketId: marketKey,
            type: "borrow",
            supplyAsset: {
              symbol: item.loanAsset.symbol || "USDC",
              name: item.loanAsset.name || item.loanAsset.symbol,
              address: loanAddr,
              decimals: item.loanAsset.decimals || 6,
              isStock: false,
            },
            collateralAsset: {
              symbol: item.collateralAsset.symbol || "STOCK",
              name: item.collateralAsset.name || item.collateralAsset.symbol,
              address: colAddr,
              decimals: item.collateralAsset.decimals || 8,
              isStock: true,
            },
            borrowAsset: {
              symbol: item.loanAsset.symbol || "USDC",
              name: item.loanAsset.name || item.loanAsset.symbol,
              address: loanAddr,
              decimals: item.loanAsset.decimals || 6,
              isStock: false,
            },
            supplyApy: Number(supplyApy.toFixed(2)),
            borrowApr: Number(borrowApr.toFixed(2)),
            maxLtv: ltvPct,
            liquidityUsd,
            tvlUsd,
            utilization: Number(utilization.toFixed(1)),
            oracle: {
              address: oracleAddr,
              name: isKnownOracle ? `Chainlink Feed (${oracleAddr.slice(0, 6)}…)` : "Unknown Oracle",
              isVerified: isKnownOracle,
              type: "chainlink",
            },
            canSupply: true,
            canBorrow: isKnownOracle,
            canUseAsCollateral: true,
            riskFlags: isKnownOracle ? [] : ["UNKNOWN_ORACLE"],
            sourceLink: `https://app.morpho.org/market?id=${marketKey}&network=base`,
            lastUpdated: new Date().toISOString(),
            status: utilization >= 95 ? "cap_reached" : "active",
            morphoParams: {
              loanToken: loanAddr,
              collateralToken: colAddr,
              oracle: oracleAddr ?? "0x0000000000000000000000000000000000000000",
              irm: irmAddr ?? "0x0000000000000000000000000000000000000000",
              lltv: BigInt(item.lltv || "0"),
            },
          });
        } catch (itemErr) {
          console.warn("[Morpho Discovery] Item parse failed:", itemErr);
        }
      }
    } catch (apiErr) {
      console.warn("[Morpho Discovery] GraphQL request failed, evaluating fallback:", apiErr);
      // If GraphQL fails completely, throw so caller can record protocol error and use last-good cache
      throw apiErr;
    }

    return markets;
  },
};
