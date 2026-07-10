import { NextResponse } from "next/server";
import { listLaunchedTokens } from "@/lib/launchpad/token-store";
import { fetchMarketSummaries } from "@/lib/launchpad/dexscreener";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { type Address } from "viem";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UNISWAP_V3_POOL_ABI = [
  {
    type: "event",
    name: "Swap",
    inputs: [
      { indexed: true, name: "sender", type: "address" },
      { indexed: true, name: "recipient", type: "address" },
      { indexed: false, name: "amount0", type: "int256" },
      { indexed: false, name: "amount1", type: "int256" },
      { indexed: false, name: "sqrtPriceX96", type: "uint160" },
      { indexed: false, name: "liquidity", type: "uint128" },
      { indexed: false, name: "tick", type: "int24" },
    ],
  },
] as const;

const VELODROME_V2_PAIR_ABI = [
  {
    type: "event",
    name: "Swap",
    inputs: [
      { indexed: true, name: "sender", type: "address" },
      { indexed: false, name: "amount0In", type: "uint256" },
      { indexed: false, name: "amount1In", type: "uint256" },
      { indexed: false, name: "amount0Out", type: "uint256" },
      { indexed: false, name: "amount1Out", type: "uint256" },
      { indexed: true, name: "to", type: "address" },
    ],
  },
] as const;

export type GlobalActivityItem = {
  type: "swap" | "launch";
  token: string;
  symbol: string;
  name: string;
  side?: "buy" | "sell";
  valueUsd?: number;
  amountEth?: string;
  txHash?: string;
  timestamp: number;
  label: string;
};

async function fetchEthUsd(): Promise<number> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: 60 } }
    );
    if (!r.ok) return 2500;
    const data = (await r.json()) as { ethereum?: { usd?: number } };
    return data.ethereum?.usd ?? 2500;
  } catch {
    return 2500;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(40, Math.max(5, parseInt(searchParams.get("limit") || "20", 10) || 20));

  try {
    const tokens = await listLaunchedTokens();
    const activities: GlobalActivityItem[] = [];

    for (const t of tokens.slice(0, 12)) {
      activities.push({
        type: "launch",
        token: t.address,
        symbol: t.symbol,
        name: t.name,
        timestamp: t.createdAt,
        label: `${t.symbol} launched on Base`,
      });
    }

    const addresses = tokens.map((t) => t.address);
    const markets = await fetchMarketSummaries(addresses);
    const pooled = tokens
      .map((t) => ({ token: t, market: markets[t.address.toLowerCase()] }))
      .filter((x) => x.market?.hasPool && x.market.pairAddress)
      .sort((a, b) => (b.market?.volume24h ?? 0) - (a.market?.volume24h ?? 0))
      .slice(0, 6);

    const ethUsd = await fetchEthUsd();
    const pub = createBasePublicClient();
    const head = await pub.getBlockNumber();
    const fromBlock = head > BigInt(4000) ? head - BigInt(4000) : BigInt(0);

    await Promise.all(
      pooled.map(async ({ token, market }) => {
        if (!market?.pairAddress) return;
        const pool = market.pairAddress as Address;
        const isV3 = (market.dexId ?? "").toLowerCase().includes("uniswap");
        const abi = isV3 ? UNISWAP_V3_POOL_ABI : VELODROME_V2_PAIR_ABI;

        try {
          const logs = await pub.getLogs({
            address: pool,
            event: abi.find((x) => x.type === "event" && x.name === "Swap")!,
            fromBlock,
            toBlock: "latest",
          });
          const recent = logs.slice(-3);
          for (const log of recent) {
            const block = await pub.getBlock({ blockNumber: log.blockNumber! });
            activities.push({
              type: "swap",
              token: token.address,
              symbol: token.symbol,
              name: token.name,
              side: "buy",
              valueUsd: (market.volume24h ?? 0) / Math.max(market.txns24h ?? 1, 1),
              txHash: log.transactionHash,
              timestamp: Number(block.timestamp) * 1000,
              label: `${token.symbol} swap on ${market.dexId ?? "DEX"}`,
            });
          }
        } catch {
          /* skip pool */
        }
      })
    );

    const sorted = activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    return NextResponse.json({ activities: sorted, ethUsd });
  } catch (e) {
    console.error("[launchpad/activity]", e);
    return NextResponse.json({ activities: [], ethUsd: 2500 });
  }
}
