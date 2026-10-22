import { getAddress, type Address } from "viem";
import type { DiscoveryAdapter, NormalizedMarket } from "../types";
import { MORPHO_BLUE_BASE } from "@/lib/lending/constants";

const MORPHO_GRAPHQL_ENDPOINT = "https://blue-api.morpho.org/graphql";

const MARKETS_QUERY = `
  query GetBaseMorphoMarkets($chainId: Int!, $first: Int!, $skip: Int) {
    markets(
      first: $first
      skip: $skip
      where: { chainId_in: [$chainId], listed: true }
    ) {
      pageInfo {
        countTotal
        count
        limit
        skip
      }
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
    const pageSize = 100;
    let skip = 0;
    let hasMore = true;
    let pagesFetched = 0;
    const maxPages = 5; // Up to 500 markets

    try {
      while (hasMore && pagesFetched < maxPages) {
        pagesFetched++;
        const response = await fetch(MORPHO_GRAPHQL_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: MARKETS_QUERY,
            variables: {
              chainId,
              first: pageSize,
              skip,
            },
          }),
          // Next.js fetch cache configuration
          next: { revalidate: 300 },
        });

        if (!response.ok) {
          throw new Error(`Morpho GraphQL HTTP error: ${response.status}`);
        }

        const json = await response.json();
        const data = json.data?.markets;
        if (!data || !Array.isArray(data.items) || data.items.length === 0) {
          break;
        }

        for (const item of data.items) {
          if (!item.collateralAsset || !item.loanAsset) continue;

          try {
            const loanAddr = getAddress(item.loanAsset.address);
            const colAddr = getAddress(item.collateralAsset.address);
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
              marketId: item.marketId || `morpho-${colAddr.slice(0, 8)}-${loanAddr.slice(0, 8)}`,
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
              sourceLink: `https://app.morpho.org/market?id=${item.marketId}&network=base`,
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

        skip += data.items.length;
        if (data.items.length < pageSize || skip >= (data.pageInfo?.countTotal || 0)) {
          hasMore = false;
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
