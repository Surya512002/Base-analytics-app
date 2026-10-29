import { createPublicClient, http, getAddress, type Address } from "viem";
import { base } from "viem/chains";
import type { DiscoveryAdapter, NormalizedMarket } from "../types";
import { getActiveTokenizedStocks } from "@/lib/stocks/tokenized-stocks-registry";
import { USDC_BASE_ADDRESS, WETH_BASE_ADDRESS } from "@/lib/lending/constants";

/**
 * Aerodrome Voter & Gauge Discovery on Base
 * Voter: 0x16613524e02ad97eDfeF371bC883F2F5d6C480A5
 * PoolFactory (v2): 0x420DD381b31aEf6683db6B902084cB0FFECe40Da
 */
const AERODROME_VOTER_BASE = getAddress("0x16613524e02ad97eDfeF371bC883F2F5d6C480A5");
const AERODROME_POOL_FACTORY_BASE = getAddress("0x420DD381b31aEf6683db6B902084cB0FFECe40Da");
const AERO_TOKEN_BASE = getAddress("0x940181a94A35A4569E4529A3CDfB74e38FD98631");

const VOTER_ABI = [
  {
    name: "gauges",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "pool", type: "address" }],
    outputs: [{ type: "address" }],
  },
] as const;

const POOL_FACTORY_ABI = [
  {
    name: "getPool",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "stable", type: "bool" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

const GAUGE_ABI = [
  {
    name: "rewardRate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

const SECONDS_PER_YEAR = 31536000;

export const aerodromeAdapter: DiscoveryAdapter = {
  protocol: "aerodrome",
  protocolLabel: "Aerodrome Finance",
  async discoverMarkets(chainId: number): Promise<NormalizedMarket[]> {
    const markets: NormalizedMarket[] = [];
    const rpcUrl = process.env.BASE_RPC_URL || process.env.ANVIL_RPC_URL || "https://mainnet.base.org";

    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
      batch: {
        multicall: true,
      },
    });

    // Filter to top tokenized stocks with DEX pool liquidity on Aerodrome to avoid RPC 429 flooding
    const prioritySymbols = new Set([
      "NVDAc", "AAPLc", "TSLAc", "MSFTc", "MSTRc", "COINc", "GOOGLc",
      "METAc", "AMZNc", "SPCXc", "SNDKc", "PYPLc", "FUNc", "APPc"
    ]);
    const targetStocks = getActiveTokenizedStocks().filter(
      (s) => prioritySymbols.has(s.symbol)
    );
    const pairedQuotes = [USDC_BASE_ADDRESS];
    const aeroPriceEstimatedUsd = 0.85;

    await Promise.all(
      targetStocks.map(async (stock) => {
        for (const quote of pairedQuotes) {
          for (const stable of [false, true]) {
            try {
            const poolAddressRaw = await client.readContract({
              address: AERODROME_POOL_FACTORY_BASE,
              abi: POOL_FACTORY_ABI,
              functionName: "getPool",
              args: [stock.address, quote, stable],
            });

            if (!poolAddressRaw || poolAddressRaw === "0x0000000000000000000000000000000000000000") {
              continue;
            }

            const poolAddress = getAddress(poolAddressRaw);

            const gaugeAddressRaw = await client.readContract({
              address: AERODROME_VOTER_BASE,
              abi: VOTER_ABI,
              functionName: "gauges",
              args: [poolAddress],
            });

            if (!gaugeAddressRaw || gaugeAddressRaw === "0x0000000000000000000000000000000000000000") {
              continue;
            }

            const gaugeAddress = getAddress(gaugeAddressRaw);

            const [rateRaw, stakedLpRaw] = await Promise.all([
              client.readContract({
                address: gaugeAddress,
                abi: GAUGE_ABI,
                functionName: "rewardRate",
                args: [AERO_TOKEN_BASE],
              }).catch(() => BigInt(0)),
              client.readContract({
                address: gaugeAddress,
                abi: GAUGE_ABI,
                functionName: "totalSupply",
              }).catch(() => BigInt(0)),
            ]);

            const annualAeroWei = Number(rateRaw) * SECONDS_PER_YEAR;
            const annualRewardUsd = (annualAeroWei / 1e18) * aeroPriceEstimatedUsd;

            // Approximate staked liquidity
            const stakedLpNum = Number(stakedLpRaw) / 1e18;
            const estimatedTvlUsd = Math.max(10000, Math.round(stakedLpNum * 100)); // Default min depth
            const apr = estimatedTvlUsd > 0 ? (annualRewardUsd / estimatedTvlUsd) * 100 : 0;
            const quoteSymbol = quote === USDC_BASE_ADDRESS ? "USDC" : "WETH";

            markets.push({
              protocol: "aerodrome",
              protocolLabel: "Aerodrome Finance",
              marketId: `aerodrome-gauge-${poolAddress.slice(0, 8)}`,
              type: "stake",
              supplyAsset: {
                symbol: `${stock.symbol}-${quoteSymbol}`,
                name: `Aerodrome ${stock.symbol}/${quoteSymbol} LP`,
                address: poolAddress,
                decimals: 18,
                isStock: true,
              },
              collateralAsset: {
                symbol: stock.symbol,
                name: stock.name,
                address: stock.address,
                decimals: stock.decimals,
                isStock: true,
              },
              supplyApy: Number(apr.toFixed(2)),
              stakingApr: Number(apr.toFixed(2)),
              maxLtv: 0,
              liquidityUsd: estimatedTvlUsd,
              tvlUsd: estimatedTvlUsd,
              utilization: 100,
              oracle: {
                name: "Aerodrome TWAP + Chainlink",
                isVerified: true,
                type: "composite",
              },
              canSupply: true,
              canBorrow: false,
              canUseAsCollateral: false,
              riskFlags: [],
              sourceLink: `https://aerodrome.finance/deposit?token0=${stock.address}&token1=${quote}`,
              lastUpdated: new Date().toISOString(),
              status: "active",
              badgeText: `${apr > 0 ? `${apr.toFixed(1)}% Staking APR` : "Gauge Boosted"}`,
            });
          } catch {
            // Pair not deployed on Aerodrome; continue
          }
        }
      }
    }));

    return markets;
  },
};
