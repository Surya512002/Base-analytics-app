import { createPublicClient, http, getAddress, type Address } from "viem";
import { base } from "viem/chains";
import type { DiscoveryAdapter, NormalizedMarket } from "../types";
import { MOONWELL_COMPTROLLER_BASE } from "@/lib/lending/constants";
import {
  isActiveStockAddress,
  isRegisteredStockAddress,
} from "@/lib/stocks/tokenized-stocks-registry";

const COMPTROLLER_ABI = [
  {
    name: "getAllMarkets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    name: "markets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "mToken", type: "address" }],
    outputs: [
      { name: "isListed", type: "bool" },
      { name: "collateralFactorMantissa", type: "uint256" },
    ],
  },
  {
    name: "oracle",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const MTOKEN_ABI = [
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "underlying", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "supplyRatePerTimestamp", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "borrowRatePerTimestamp", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getCash", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "totalBorrows", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const SECONDS_PER_YEAR = 31536000;

export const moonwellAdapter: DiscoveryAdapter = {
  protocol: "moonwell",
  protocolLabel: "Moonwell",
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

    try {
      const allMarkets = (await client.readContract({
        address: MOONWELL_COMPTROLLER_BASE,
        abi: COMPTROLLER_ABI,
        functionName: "getAllMarkets",
      })) as Address[];

      await Promise.all(
        allMarkets.map(async (mTokenRaw) => {
          try {
            const mToken = getAddress(mTokenRaw);
            const symbol = await client
              .readContract({ address: mToken, abi: MTOKEN_ABI, functionName: "symbol" })
              .catch(() => "mToken");

            let underlyingAddress = mToken;
            try {
              underlyingAddress = getAddress(
                await client.readContract({
                  address: mToken,
                  abi: MTOKEN_ABI,
                  functionName: "underlying",
                })
              );
            } catch {
              // Native ETH or direct token
            }

            const cleanSym = String(symbol);
            const isStockOrCandidate =
              isActiveStockAddress(underlyingAddress) ||
              isRegisteredStockAddress(underlyingAddress) ||
              (cleanSym.endsWith("c") && cleanSym.length <= 6) ||
              /equity|stock|shares/i.test(cleanSym);

            if (!isStockOrCandidate) {
              return;
            }

            const [marketInfo, decimals, cash, totalBorrows, supplyRate, borrowRate] =
              await Promise.all([
                client.readContract({
                  address: MOONWELL_COMPTROLLER_BASE,
                  abi: COMPTROLLER_ABI,
                  functionName: "markets",
                  args: [mToken],
                }),
                client.readContract({ address: mToken, abi: MTOKEN_ABI, functionName: "decimals" }).catch(() => 8),
                client.readContract({ address: mToken, abi: MTOKEN_ABI, functionName: "getCash" }).catch(() => BigInt(0)),
                client.readContract({ address: mToken, abi: MTOKEN_ABI, functionName: "totalBorrows" }).catch(() => BigInt(0)),
                client.readContract({ address: mToken, abi: MTOKEN_ABI, functionName: "supplyRatePerTimestamp" }).catch(() => BigInt(0)),
                client.readContract({ address: mToken, abi: MTOKEN_ABI, functionName: "borrowRatePerTimestamp" }).catch(() => BigInt(0)),
              ]);

            const [isListed, collateralFactorMantissa] = marketInfo;
            if (!isListed) return;

            const ltvPct = Math.round((Number(collateralFactorMantissa) / 1e18) * 100);
            const supplyApy = (Number(supplyRate) / 1e18) * SECONDS_PER_YEAR * 100;
            const borrowApr = (Number(borrowRate) / 1e18) * SECONDS_PER_YEAR * 100;

            const dec = Number(decimals);
            const cashNum = Number(cash) / 10 ** dec;
            const borrowNum = Number(totalBorrows) / 10 ** dec;
            const tvlUsd = Math.round(cashNum + borrowNum);
            const liquidityUsd = Math.round(cashNum);
            const utilization = tvlUsd > 0 ? (borrowNum / tvlUsd) * 100 : 0;

            markets.push({
              protocol: "moonwell",
              protocolLabel: "Moonwell",
              marketId: `moonwell-${mToken.slice(0, 10)}`,
              type: "lend",
              supplyAsset: {
                symbol: String(symbol).replace(/^m/, ""),
                name: String(symbol),
                address: underlyingAddress,
                decimals: dec,
                isStock: false,
              },
              supplyApy: Number(supplyApy.toFixed(2)),
              borrowApr: Number(borrowApr.toFixed(2)),
              maxLtv: ltvPct,
              liquidityUsd,
              tvlUsd,
              utilization: Number(utilization.toFixed(1)),
              oracle: {
                name: "Moonwell Chainlink Composite Oracle",
                isVerified: true,
                type: "chainlink",
              },
              canSupply: true,
              canBorrow: true,
              canUseAsCollateral: ltvPct > 0,
              riskFlags: [],
              sourceLink: `https://moonwell.fi/markets/base/${mToken}`,
              lastUpdated: new Date().toISOString(),
              status: utilization >= 95 ? "cap_reached" : "active",
            });
          } catch (mErr) {
            console.warn("[Moonwell Discovery] mToken read failed:", mErr);
          }
        })
      );
    } catch (err) {
      console.warn("[Moonwell Discovery] Failed to read Moonwell Comptroller:", err);
      throw err;
    }

    return markets;
  },
};
