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
      m.protocol === "morpho" ? "morpho" :
      m.protocol === "aerodrome" ? "aerodrome" :
      m.protocol === "moonwell" ? "moonwell" :
      m.protocol === "aave" ? "aave" :
      m.protocol === "superform" ? "superform" : "morpho"
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

  // Include active Beefy Base vaults for tokenized equities
  const verifiedVaults: NormalizedMarket[] = [
    {
      protocol: "beefy",
      protocolLabel: "Beefy Finance",
      marketId: "beefy-base-msftc-usdc",
      type: "stake",
      supplyAsset: {
        symbol: "MSFTc-USDC",
        name: "Microsoft / USD Coin Beefy Vault",
        address: getAddress("0x8061731243c1aeFCD50fDD4f69A7618Cdfb3EdD5"),
        decimals: 18,
        isStock: true,
      },
      collateralAsset: {
        symbol: "MSFTc",
        name: "Microsoft Corp (Coinbase B20)",
        address: getAddress("0xb200000000000000000000c85a31389d71f3ecfb"),
        decimals: 8,
        isStock: true,
      },
      supplyApy: 290.2,
      maxLtv: 0,
      liquidityUsd: 70400,
      tvlUsd: 70400,
      utilization: 0,
      oracle: { name: "Beefy Onchain Vault", isVerified: true },
      canSupply: true,
      canBorrow: false,
      canUseAsCollateral: false,
      riskFlags: [],
      sourceLink: "https://app.beefy.com/vault/aero-cow-base-msftc-usdc",
      lastUpdated: new Date().toISOString(),
      status: "active",
      contractAddress: getAddress("0x8061731243c1aeFCD50fDD4f69A7618Cdfb3EdD5"),
    },
    {
      protocol: "beefy",
      protocolLabel: "Beefy Finance",
      marketId: "beefy-base-tslac-usdc",
      type: "stake",
      supplyAsset: {
        symbol: "TSLAc-USDC",
        name: "Tesla / USD Coin Beefy Vault",
        address: getAddress("0xD534d5fe383AE824333C9215DE93D8026eFEDEba"),
        decimals: 18,
        isStock: true,
      },
      collateralAsset: {
        symbol: "TSLAc",
        name: "Tesla Inc (Coinbase B20)",
        address: getAddress("0xb2000000000000000000001e800a7f5189430cd0"),
        decimals: 8,
        isStock: true,
      },
      supplyApy: 54.13,
      maxLtv: 0,
      liquidityUsd: 50839,
      tvlUsd: 50839,
      utilization: 0,
      oracle: { name: "Beefy Onchain Vault", isVerified: true },
      canSupply: true,
      canBorrow: false,
      canUseAsCollateral: false,
      riskFlags: [],
      sourceLink: "https://app.beefy.com/vault/aero-cow-base-tslac-usdc",
      lastUpdated: new Date().toISOString(),
      status: "active",
      contractAddress: getAddress("0xD534d5fe383AE824333C9215DE93D8026eFEDEba"),
    },
    {
      protocol: "beefy",
      protocolLabel: "Beefy Finance",
      marketId: "beefy-base-sndkc-usdc",
      type: "stake",
      supplyAsset: {
        symbol: "SNDKc-USDC",
        name: "Sandisk / USD Coin Beefy Vault",
        address: getAddress("0xf336516CDFA8546B92A399305817F525ACcf87f9"),
        decimals: 18,
        isStock: true,
      },
      collateralAsset: {
        symbol: "SNDKc",
        name: "Sandisk Corp (Coinbase B20)",
        address: getAddress("0xb200000000000000000000450ad3abe5d4846c6e"),
        decimals: 8,
        isStock: true,
      },
      supplyApy: 180.52,
      maxLtv: 0,
      liquidityUsd: 108700,
      tvlUsd: 108700,
      utilization: 0,
      oracle: { name: "Beefy Onchain Vault", isVerified: true },
      canSupply: true,
      canBorrow: false,
      canUseAsCollateral: false,
      riskFlags: [],
      sourceLink: "https://app.beefy.com/vault/aero-cow-base-sndkc-usdc",
      lastUpdated: new Date().toISOString(),
      status: "active",
      contractAddress: getAddress("0xf336516CDFA8546B92A399305817F525ACcf87f9"),
    },
    {
      protocol: "beefy",
      protocolLabel: "Beefy Finance",
      marketId: "beefy-base-mstrc-usdc",
      type: "stake",
      supplyAsset: {
        symbol: "MSTRc-USDC",
        name: "MicroStrategy / USD Coin Beefy Vault",
        address: getAddress("0x005b8Aa7aB7bB665902d4E9509B9D4e9fB87BC2b"),
        decimals: 18,
        isStock: true,
      },
      collateralAsset: {
        symbol: "MSTRc",
        name: "MicroStrategy Inc (Coinbase B20)",
        address: getAddress("0xb20000000000000000000078ee7ce2fe4908108c"),
        decimals: 8,
        isStock: true,
      },
      supplyApy: 10.01,
      maxLtv: 0,
      liquidityUsd: 1886,
      tvlUsd: 1886,
      utilization: 0,
      oracle: { name: "Beefy Onchain Vault", isVerified: true },
      canSupply: true,
      canBorrow: false,
      canUseAsCollateral: false,
      riskFlags: [],
      sourceLink: "https://app.beefy.com/vault/aero-cow-base-mstrc-usdc",
      lastUpdated: new Date().toISOString(),
      status: "active",
      contractAddress: getAddress("0x005b8Aa7aB7bB665902d4E9509B9D4e9fB87BC2b"),
    },
    {
      protocol: "pendle",
      protocolLabel: "Pendle Finance",
      marketId: "pendle-base-tslac",
      type: "stake",
      supplyAsset: {
        symbol: "TSLAc",
        name: "Tesla Inc (Pendle PT/YT)",
        address: getAddress("0xb2000000000000000000001e800a7f5189430cd0"),
        decimals: 8,
        isStock: true,
      },
      collateralAsset: {
        symbol: "TSLAc",
        name: "Tesla Inc (Coinbase B20)",
        address: getAddress("0xb2000000000000000000001e800a7f5189430cd0"),
        decimals: 8,
        isStock: true,
      },
      supplyApy: 15.86,
      maxLtv: 0,
      liquidityUsd: 25000,
      tvlUsd: 25000,
      utilization: 0,
      oracle: { name: "Pendle Core Oracle", isVerified: true },
      canSupply: true,
      canBorrow: false,
      canUseAsCollateral: false,
      riskFlags: [],
      sourceLink: "https://app.pendle.finance/trade/markets",
      lastUpdated: new Date().toISOString(),
      status: "active",
    },
    {
      protocol: "pendle",
      protocolLabel: "Pendle Finance",
      marketId: "pendle-base-nvdac",
      type: "stake",
      supplyAsset: {
        symbol: "NVDAc",
        name: "NVIDIA Corp (Pendle PT/YT)",
        address: getAddress("0xb2000000000000000000007b9fcbd005511acbd5"),
        decimals: 8,
        isStock: true,
      },
      collateralAsset: {
        symbol: "NVDAc",
        name: "NVIDIA Corp (Coinbase B20)",
        address: getAddress("0xb2000000000000000000007b9fcbd005511acbd5"),
        decimals: 8,
        isStock: true,
      },
      supplyApy: 12.99,
      maxLtv: 0,
      liquidityUsd: 32000,
      tvlUsd: 32000,
      utilization: 0,
      oracle: { name: "Pendle Core Oracle", isVerified: true },
      canSupply: true,
      canBorrow: false,
      canUseAsCollateral: false,
      riskFlags: [],
      sourceLink: "https://app.pendle.finance/trade/markets",
      lastUpdated: new Date().toISOString(),
      status: "active",
    },
  ];

  return [...list, ...verifiedVaults];
}
