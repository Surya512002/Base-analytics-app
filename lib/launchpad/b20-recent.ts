import {
  decodeEventLog,
  type Hex,
  type Log,
} from "viem";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import type { LaunchedToken } from "@/lib/launchpad/types";

const B20_CREATED_ABI = [
  {
    type: "event",
    name: "B20Created",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "variant", type: "uint8", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "decimals", type: "uint8", indexed: false },
      { name: "variantEventParams", type: "bytes", indexed: false },
    ],
  },
] as const;

/** ~2k blocks ≈ a few minutes on Base; keep under eth_getLogs range limits. */
const LOOKBACK_BLOCKS = 8_000;
const MAX_RECENT = 48;
const CHUNK = 2_000;

export type RecentB20Create = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  variant: number;
  txHash: string;
  launchBlock: number;
  createdAt: number;
  creator: string;
};

function decodeCreated(log: Log): Omit<RecentB20Create, "createdAt" | "creator"> | null {
  try {
    const decoded = decodeEventLog({
      abi: B20_CREATED_ABI,
      data: log.data,
      topics: log.topics,
    });
    if (decoded.eventName !== "B20Created") return null;
    const args = decoded.args as {
      token: `0x${string}`;
      variant: number;
      name: string;
      symbol: string;
      decimals: number;
    };
    return {
      address: args.token.toLowerCase(),
      name: args.name?.trim() || "B20 Token",
      symbol: (args.symbol?.trim() || "B20").toUpperCase(),
      decimals: Number(args.decimals) || 18,
      variant: Number(args.variant),
      txHash: (log.transactionHash ?? "") as string,
      launchBlock: Number(log.blockNumber ?? 0),
    };
  } catch {
    return null;
  }
}

async function fetchLogsChunk(
  fromBlock: bigint,
  toBlock: bigint
): Promise<Log[]> {
  const client = createBasePublicClient();
  return client.getLogs({
    address: B20_FACTORY_ADDRESS,
    event: B20_CREATED_ABI[0],
    fromBlock,
    toBlock,
  });
}

/**
 * Index recent B20 factory creates — same discovery model as cc0.company.
 * Lists tokens even before they have DEX liquidity so users can open trade.
 */
export async function fetchRecentB20Creates(
  lookbackBlocks = LOOKBACK_BLOCKS
): Promise<RecentB20Create[]> {
  const client = createBasePublicClient();
  const latest = await client.getBlockNumber();
  const start = latest > BigInt(lookbackBlocks) ? latest - BigInt(lookbackBlocks) : BigInt(0);

  const logs: Log[] = [];
  for (let from = start; from <= latest; from += BigInt(CHUNK)) {
    const to = from + BigInt(CHUNK) - BigInt(1);
    const chunkTo = to > latest ? latest : to;
    try {
      const chunk = await fetchLogsChunk(from, chunkTo);
      logs.push(...chunk);
    } catch (e) {
      console.error("[b20-recent] getLogs chunk failed", from.toString(), e);
    }
  }

  const byAddr = new Map<string, Omit<RecentB20Create, "createdAt" | "creator">>();
  for (const log of logs) {
    const row = decodeCreated(log);
    if (!row?.address.startsWith("0xb20")) continue;
    byAddr.set(row.address, row);
  }

  const rows = [...byAddr.values()]
    .sort((a, b) => b.launchBlock - a.launchBlock)
    .slice(0, MAX_RECENT);

  if (!rows.length) return [];

  const uniqueBlocks = [...new Set(rows.map((r) => r.launchBlock))];
  const blockTimes = new Map<number, number>();
  await Promise.all(
    uniqueBlocks.slice(0, 24).map(async (bn) => {
      try {
        const block = await client.getBlock({ blockNumber: BigInt(bn) });
        blockTimes.set(bn, Number(block.timestamp) * 1000);
      } catch {
        blockTimes.set(bn, Date.now());
      }
    })
  );

  const creators = new Map<string, string>();
  await Promise.all(
    rows.slice(0, 24).map(async (r) => {
      if (!r.txHash) return;
      try {
        const tx = await client.getTransaction({ hash: r.txHash as Hex });
        creators.set(r.address, tx.from.toLowerCase());
      } catch {
        /* skip */
      }
    })
  );

  return rows.map((r) => ({
    ...r,
    createdAt: blockTimes.get(r.launchBlock) ?? Date.now(),
    creator: creators.get(r.address) ?? "",
  }));
}

export function recentB20ToLaunchedToken(row: RecentB20Create): LaunchedToken {
  return {
    address: row.address,
    name: row.name,
    symbol: row.symbol,
    decimals: row.decimals,
    creator: row.creator,
    txHash: row.txHash,
    createdAt: row.createdAt,
    launchBlock: row.launchBlock,
    source: "b20",
    description: "Recently created on Base via B20 factory",
  };
}
