import { createPublicClient, http, getAddress, parseAbi, type Address } from "viem";
import { base } from "viem/chains";
import type { DiscoveryAdapter, NormalizedMarket } from "../types";
import { AAVE_V3_POOL_BASE, USDC_BASE_ADDRESS } from "@/lib/lending/constants";

/**
 * AAVE PROTOCOL ADAPTER FOR BASE MAINNET (CHAIN ID 8453)
 *
 * NOTE ON AAVE VERSIONS ON BASE:
 * - Aave V3: DEPLOYED and LIVE on Base mainnet.
 *   Pool Address: 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
 *   PoolDataProvider: 0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac
 *   PriceOracle: 0x2Cc00a68351e074b04C18856641a5C1b6De258Ab
 * - Aave V4: NOT YET DEPLOYED on Base.
 */

const AAVE_V3_DATA_PROVIDER_BASE = getAddress("0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac");
const AAVE_V3_ORACLE_BASE = getAddress("0x2Cc00a68351e074b04C18856641a5C1b6De258Ab");

const AAVE_DATA_PROVIDER_ABI = [
  {
    name: "getAllReservesTokens",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        components: [
          { name: "symbol", type: "string" },
          { name: "tokenAddress", type: "address" },
        ],
        type: "tuple[]",
      },
    ],
  },
  {
    name: "getReserveConfigurationData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "decimals", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "liquidationThreshold", type: "uint256" },
      { name: "liquidationBonus", type: "uint256" },
      { name: "reserveFactor", type: "uint256" },
      { name: "usageAsCollateralEnabled", type: "bool" },
      { name: "borrowingEnabled", type: "bool" },
      { name: "stableBorrowRateEnabled", type: "bool" },
      { name: "isActive", type: "bool" },
      { name: "isFrozen", type: "bool" },
    ],
  },
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "unbacked", type: "uint256" },
      { name: "accruedToTreasuryScaled", type: "uint256" },
      { name: "totalAToken", type: "uint256" },
      { name: "totalStableDebt", type: "uint256" },
      { name: "totalVariableDebt", type: "uint256" },
      { name: "liquidityRate", type: "uint256" },
      { name: "variableBorrowRate", type: "uint256" },
      { name: "stableBorrowRate", type: "uint256" },
      { name: "averageStableBorrowRate", type: "uint256" },
      { name: "liquidityIndex", type: "uint256" },
      { name: "variableBorrowIndex", type: "uint256" },
      { name: "lastUpdateTimestamp", type: "uint40" },
    ],
  },
] as const;

export const aaveAdapter: DiscoveryAdapter = {
  protocol: "aave",
  protocolLabel: "Aave V3",
  async discoverMarkets(chainId: number): Promise<NormalizedMarket[]> {
    const markets: NormalizedMarket[] = [];
    const rpcUrl = process.env.BASE_RPC_URL || process.env.ANVIL_RPC_URL || "https://mainnet.base.org";

    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    });

    try {
      const reservesTokens = (await client.readContract({
        address: AAVE_V3_DATA_PROVIDER_BASE,
        abi: AAVE_DATA_PROVIDER_ABI,
        functionName: "getAllReservesTokens",
      })) as Array<{ symbol: string; tokenAddress: Address }>;

      for (const res of reservesTokens) {
        try {
          const tokenAddress = getAddress(res.tokenAddress);
          const [config, data] = await Promise.all([
            client.readContract({
              address: AAVE_V3_DATA_PROVIDER_BASE,
              abi: AAVE_DATA_PROVIDER_ABI,
              functionName: "getReserveConfigurationData",
              args: [tokenAddress],
            }),
            client.readContract({
              address: AAVE_V3_DATA_PROVIDER_BASE,
              abi: AAVE_DATA_PROVIDER_ABI,
              functionName: "getReserveData",
              args: [tokenAddress],
            }),
          ]);

          // RAY is 1e27 in Aave
          const RAY = 1e27;
          const supplyApy = (Number(data[5]) / RAY) * 100;
          const borrowApr = (Number(data[6]) / RAY) * 100;

          const ltvPct = Number(config[1]) / 100; // basis points to %
          const canSupply = config[8]; // isActive
          const canBorrow = config[6] && !config[9]; // borrowingEnabled && !isFrozen
          const canUseAsCollateral = config[5]; // usageAsCollateralEnabled

          // Real USD TVL and liquidity from totalAToken multiplied by oracle price
          const dec = Number(config[0]);
          const totalAssets = Number(data[2]) / 10 ** dec;
          const totalDebt = Number(data[4]) / 10 ** dec;
          const availableAssets = Math.max(0, totalAssets - totalDebt);

          let priceUsd = 1.0;
          if (tokenAddress.toLowerCase() !== USDC_BASE_ADDRESS.toLowerCase()) {
            try {
              const rawPrice = await client.readContract({
                address: AAVE_V3_ORACLE_BASE,
                abi: parseAbi(["function getAssetPrice(address asset) external view returns (uint256)"]),
                functionName: "getAssetPrice",
                args: [tokenAddress],
              });
              if (rawPrice > BigInt(0)) {
                priceUsd = Number(rawPrice) / 1e8;
              }
            } catch {
              // Fallback to 1.0 if oracle call times out
            }
          }

          const tvlUsd = Math.round(totalAssets * priceUsd);
          const liquidityUsd = Math.round(availableAssets * priceUsd);
          const utilization = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;

          markets.push({
            protocol: "aave",
            protocolLabel: "Aave V3",
            marketId: `aave-v3-${tokenAddress.slice(0, 10)}`,
            type: "lend",
            supplyAsset: {
              symbol: res.symbol,
              name: res.symbol,
              address: tokenAddress,
              decimals: dec,
              isStock: false, // Evaluated by engine matching rule
            },
            supplyApy: Number(supplyApy.toFixed(2)),
            borrowApr: Number(borrowApr.toFixed(2)),
            maxLtv: ltvPct,
            liquidityUsd,
            tvlUsd,
            utilization: Number(utilization.toFixed(1)),
            oracle: {
              name: "Aave V3 Base Price Oracle",
              isVerified: true,
              type: "chainlink",
            },
            canSupply,
            canBorrow,
            canUseAsCollateral,
            riskFlags: config[9] ? ["FROZEN"] : [],
            sourceLink: `https://app.aave.com/reserve-overview/?underlyingAsset=${tokenAddress}&marketName=proto_base_v3`,
            lastUpdated: new Date().toISOString(),
            status: config[9] ? "paused" : utilization >= 95 ? "cap_reached" : "active",
          });
        } catch (resErr) {
          console.warn(`[Aave Discovery] Reserve ${res.symbol} read failed:`, resErr);
        }
      }
    } catch (err) {
      console.warn("[Aave Discovery] Failed to read Aave V3 reserves on Base:", err);
      throw err;
    }

    return markets;
  },
};
