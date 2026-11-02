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

export const AERODROME_STOCK_POOL_ADDRESSES: Record<string, `0x${string}`> = {
  NVDAc: "0xA282064541Bb45Caa046fB9f21a240671aBB7f46",
  AAPLc: "0x7E8C552289cAB5c83C488fd6127a9E5C1A4729f1",
  MSFTc: "0xAA4743151ac49BF80D13C51e2B2836b143B64732",
  TSLAc: "0x6f7149Ac939f178BDE4BD346B7c9234fa641B6A0",
  MSTRc: "0xd145b66F74B73a441ec15Eff80EeB653D8E45dFf",
  AMZNc: "0x7a83f56a9D2a7f6c327ADA3d2b7F0ce6Ba489361",
  METAc: "0x8d32dcf9f7787D9cC0ac78cdE512c386Cbf19650",
  GOOGLc: "0x8cBeC857244EC728a44e6650f62a0ABe53319fF3",
  SNDKc: "0x30c23fB48A81392C4e453cacd714bfAD848d1661",
  PLTRc: "0x6f96D1002b2C0671bbBDd381Ca2D3dE030282Cf4",
  SPCXc: "0x2618EEEC4686a000529fC822b8f47c0E4853acDC",
  MUc: "0x540e3642f583f0366cBb2d9507940e59C9cEB299",
};

export const aerodromeAdapter: DiscoveryAdapter = {
  protocol: "aerodrome",
  protocolLabel: "Aerodrome Finance",
  async discoverMarkets(chainId: number): Promise<NormalizedMarket[]> {
    const markets: NormalizedMarket[] = [];

    // Filter to top tokenized stocks with DEX pool liquidity on Aerodrome
    const prioritySymbols = new Set([
      "NVDAc", "AAPLc", "TSLAc", "MSFTc", "MSTRc", "COINc", "GOOGLc",
      "METAc", "AMZNc", "SPCXc", "SNDKc", "PYPLc", "FUNc", "APPc"
    ]);
    const targetStocks = getActiveTokenizedStocks().filter(
      (s) => prioritySymbols.has(s.symbol)
    );

    // 1. Try real-time yields from DefiLlama pools (live Slipstream/Aerodrome Base yields)
    try {
      const res = await fetch("https://yields.llama.fi/pools", { next: { revalidate: 120 } });
      if (res.ok) {
        const json = (await res.json()) as any;
        const aeroBase = (json?.data || []).filter(
          (p: any) => p.chain === "Base" && (p.project === "aerodrome" || p.project === "aerodrome-slipstream")
        );

        for (const stock of targetStocks) {
          const symUpper = stock.symbol.toUpperCase();
          const match =
            aeroBase.find((p: any) => {
              const pSym = (p.symbol || "").toUpperCase();
              return pSym.includes(symUpper) && (pSym.includes("USDC") || pSym.includes("USD"));
            }) ||
            aeroBase.find((p: any) => (p.symbol || "").toUpperCase().includes(symUpper));

          if (match) {
            const apy = Math.round(Number(match.apy || 0) * 100) / 100;
            const tvlUsd = Math.round(Number(match.tvlUsd || 0));
            const poolAddr = AERODROME_STOCK_POOL_ADDRESSES[stock.symbol] || stock.address;

            markets.push({
              protocol: "aerodrome",
              protocolLabel: "Aerodrome Finance",
              marketId: `aerodrome-gauge-${poolAddr.slice(0, 8)}`,
              type: "stake",
              supplyAsset: {
                symbol: `${stock.symbol}-USDC`,
                name: `Aerodrome ${stock.symbol}/USDC LP`,
                address: poolAddr,
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
              supplyApy: apy,
              stakingApr: apy,
              maxLtv: 0,
              liquidityUsd: tvlUsd,
              tvlUsd: tvlUsd,
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
              sourceLink: `https://aerodrome.finance/deposit?token0=${stock.address}&token1=${USDC_BASE_ADDRESS}`,
              lastUpdated: new Date().toISOString(),
              status: "active",
              badgeText: `${apy > 0 ? `${apy.toFixed(1)}% Staking APR` : "Gauge Boosted"}`,
              contractAddress: poolAddr,
            });
          }
        }

        if (markets.length > 0) {
          return markets;
        }
      }
    } catch {
      // Fallback to onchain RPC reads if DefiLlama yields endpoint fails
    }

    const rpcUrl = process.env.BASE_RPC_URL || process.env.ANVIL_RPC_URL || "https://mainnet.base.org";

    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
      batch: {
        multicall: true,
      },
    });

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
