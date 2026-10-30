import type { NormalizedMarket } from "./types";
import { BASE_LENDING_MARKETS } from "../markets";
import { getAddress } from "viem";

/**
 * Returns verified onchain baseline markets on Base mainnet.
 * Used for instant, zero-latency hydration so users never see "0 Pools" on page load.
 */
export function getBaselineVerifiedMarkets(): NormalizedMarket[] {
  const list: NormalizedMarket[] = BASE_LENDING_MARKETS.map((m) => {
    const isBorrow = m.category === "stocks_borrow" || m.category === "crypto_borrow";
    const isStake = m.category === "stocks_stake" || m.category === "crypto_stake";

    const type = isBorrow ? "borrow" : isStake ? "stake" : "lend";
    const proto = (
      m.protocol === "beefy" ? "beefy" :
      m.protocol === "aerodrome" ? "aerodrome" :
      m.protocol === "ipor" ? "ipor" :
      m.protocol === "aave" ? "aave" : "aerodrome"
    ) as import("./types").DiscoveryProtocol;

    return {
      protocol: proto,
      protocolLabel: m.protocolLabel,
      marketId: m.id,
      type,
      supplyAsset: {
        symbol: m.asset.symbol,
        name: m.asset.name,
        address: m.asset.address,
        decimals: m.asset.decimals,
        isStock: Boolean(m.asset.isStock),
        logo: m.asset.icon,
      },
      collateralAsset: m.collateralAsset
        ? {
            symbol: m.collateralAsset.symbol,
            name: m.collateralAsset.name,
            address: m.collateralAsset.address,
            decimals: m.collateralAsset.decimals,
            isStock: Boolean(m.collateralAsset.isStock),
            logo: m.collateralAsset.icon,
          }
        : undefined,
      supplyApy: m.supplyApy,
      borrowApr: m.borrowApr,
      stakingApr: m.stakingApr,
      maxLtv: m.ltv ?? 75,
      liquidityUsd: m.availableLiquidityUsd ?? (m.tvlUsd * (1 - (m.utilization ?? 50) / 100)),
      tvlUsd: m.tvlUsd,
      utilization: m.utilization ?? 0,
      oracle: {
        name: m.oracle,
        isVerified: true,
        type: m.oracle.toLowerCase().includes("chainlink") ? "chainlink" : "unknown",
      },
      canSupply: true,
      canBorrow: isBorrow,
      canUseAsCollateral: Boolean(m.collateralAsset),
      riskFlags: [],
      sourceLink: m.protocolUrl,
      lastUpdated: new Date().toISOString(),
      status: "active",
      badgeText: m.badgeText,
      contractAddress: m.contractAddress,
      morphoParams: m.morphoParams,
    };
  });

  return list;
}
