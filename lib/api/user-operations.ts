import { parseAbiItem, type Address } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { ENTRYPOINT_V06, ENTRYPOINT_V07 } from "@/lib/constants/contracts";
import type { AlchemyTransfer } from "@/lib/types/wallet";

const ZERO = "0x0000000000000000000000000000000000000000";
/** Prefer smaller chunks — public Base RPCs reject large eth_getLogs windows. */
const CHUNK_SIZES = [BigInt(500_000), BigInt(150_000), BigInt(40_000)] as const;

const USER_OP_EVENT = parseAbiItem(
  "event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)"
);

export interface UserOpFetchOptions {
  /** Abort RPC scan after this many ms (non-fatal). */
  timeoutMs?: number;
  /** How many block chunks to scan per EntryPoint (newest first). */
  maxChunks?: number;
  /** Resume from this chunk index (0 = latest). */
  startChunk?: number;
}

export interface UserOpFetchResult {
  transfers: AlchemyTransfer[];
  chunksScanned: number;
  complete: boolean;
}

type Client = ReturnType<typeof createBasePublicClient>;

async function getUserOpLogs(
  client: Client,
  entryPoint: Address,
  wallet: Address,
  fromBlock: bigint,
  toBlock: bigint
) {
  let lastErr: unknown;
  for (const maxSpan of CHUNK_SIZES) {
    const span = toBlock - fromBlock + BigInt(1);
    if (span <= maxSpan) {
      try {
        return await client.getLogs({
          address: entryPoint,
          event: USER_OP_EVENT,
          args: { sender: wallet },
          fromBlock,
          toBlock,
        });
      } catch (e) {
        lastErr = e;
        continue;
      }
    }

    const merged: Awaited<ReturnType<typeof client.getLogs>> = [];
    for (let start = fromBlock; start <= toBlock; start += maxSpan) {
      const end =
        start + maxSpan - BigInt(1) > toBlock
          ? toBlock
          : start + maxSpan - BigInt(1);
      try {
        const part = await client.getLogs({
          address: entryPoint,
          event: USER_OP_EVENT,
          args: { sender: wallet },
          fromBlock: start,
          toBlock: end,
        });
        merged.push(...part);
      } catch (e) {
        lastErr = e;
      }
    }
    if (merged.length > 0 || !lastErr) return merged;
  }
  if (lastErr) throw lastErr;
  return [];
}

async function fetchUserOpLogs(
  address: string,
  options: UserOpFetchOptions
): Promise<UserOpFetchResult> {
  const wallet = address.toLowerCase() as Address;
  const client = createBasePublicClient();
  const entryPoints = [ENTRYPOINT_V06, ENTRYPOINT_V07] as Address[];
  const transfers: AlchemyTransfer[] = [];
  const seenOpIds = new Set<string>();
  const maxChunks = options.maxChunks ?? 8;
  const startChunk = options.startChunk ?? 0;
  const deadline = Date.now() + (options.timeoutMs ?? 12_000);
  const primaryChunk = CHUNK_SIZES[0];

  let latest: bigint;
  try {
    latest = await client.getBlockNumber();
  } catch {
    return { transfers: [], chunksScanned: 0, complete: false };
  }

  let chunksScanned = 0;
  let hitGenesis = false;
  let timedOut = false;

  for (const entryPoint of entryPoints) {
    for (let i = startChunk; i < startChunk + maxChunks; i++) {
      if (Date.now() > deadline) {
        timedOut = true;
        break;
      }

      const toBlock =
        latest - BigInt(i) * primaryChunk > BigInt(0)
          ? latest - BigInt(i) * primaryChunk
          : BigInt(0);
      const fromBlock =
        toBlock > primaryChunk ? toBlock - primaryChunk + BigInt(1) : BigInt(0);

      let logs: Awaited<ReturnType<typeof getUserOpLogs>>;
      try {
        logs = await getUserOpLogs(
          client,
          entryPoint,
          wallet,
          fromBlock,
          toBlock
        );
      } catch {
        if (fromBlock === BigInt(0)) break;
        continue;
      }

      chunksScanned++;

      let chunkTimestamp = new Date().toISOString();
      if (logs.length > 0) {
        try {
          const block = await client.getBlock({ blockNumber: toBlock });
          chunkTimestamp = new Date(
            Number(block.timestamp) * 1000
          ).toISOString();
        } catch {
          /* use fallback */
        }
      }

      for (const log of logs) {
        const txHash = log.transactionHash;
        if (!txHash) continue;
        const raw = log as {
          args?: {
            userOpHash?: `0x${string}`;
            paymaster?: Address;
          };
          logIndex?: number | null;
        };
        const userOpHash = (
          raw.args?.userOpHash ||
          `${txHash}-${raw.logIndex ?? 0}`
        ).toLowerCase();
        if (seenOpIds.has(userOpHash)) continue;
        seenOpIds.add(userOpHash);

        const paymaster = raw.args?.paymaster?.toLowerCase();
        const sponsored = Boolean(paymaster && paymaster !== ZERO);

        transfers.push({
          hash: txHash,
          category: "useroperation",
          value: 0,
          asset: "ETH",
          from: wallet,
          to: entryPoint.toLowerCase(),
          metadata: {
            blockTimestamp: chunkTimestamp,
            isUserOperation: true,
            isSponsored: sponsored,
            userOpHash,
            walletParticipated: true,
          },
        });
      }

      if (fromBlock === BigInt(0)) {
        hitGenesis = true;
        break;
      }
    }
    if (timedOut) break;
  }

  return {
    transfers,
    chunksScanned: startChunk + chunksScanned,
    complete: hitGenesis && !timedOut,
  };
}

export async function fetchUserOperationActivity(
  address: string,
  options: UserOpFetchOptions = {}
): Promise<AlchemyTransfer[]> {
  const result = await fetchUserOpLogs(address, options);
  return result.transfers;
}

export async function fetchUserOperationActivityWithProgress(
  address: string,
  options: UserOpFetchOptions = {}
): Promise<UserOpFetchResult> {
  return fetchUserOpLogs(address, options);
}

/** Scan EntryPoint history deeply (Base App / AA / paymaster txs). */
export async function fetchUserOperationActivityFull(
  address: string
): Promise<AlchemyTransfer[]> {
  return fetchUserOperationActivity(address, {
    timeoutMs: 120_000,
    maxChunks: 200,
  });
}
