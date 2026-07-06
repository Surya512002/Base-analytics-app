import { parseAbiItem, type Address } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { ENTRYPOINT_V06, ENTRYPOINT_V07 } from "@/lib/constants/contracts";
import type { AlchemyTransfer } from "@/lib/types/wallet";

const ZERO = "0x0000000000000000000000000000000000000000";
const CHUNK_SIZE = BigInt(1_500_000);

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

async function fetchUserOpLogs(
  address: string,
  options: UserOpFetchOptions
): Promise<UserOpFetchResult> {
  const wallet = address.toLowerCase() as Address;
  const client = createBasePublicClient();
  const entryPoints = [ENTRYPOINT_V06, ENTRYPOINT_V07] as Address[];
  const transfers: AlchemyTransfer[] = [];
  const seenHashes = new Set<string>();
  const maxChunks = options.maxChunks ?? 8;
  const startChunk = options.startChunk ?? 0;
  const deadline = Date.now() + (options.timeoutMs ?? 12_000);

  let latest: bigint;
  try {
    latest = await client.getBlockNumber();
  } catch {
    return { transfers: [], chunksScanned: 0, complete: false };
  }

  let chunksScanned = 0;
  let hitGenesis = false;

  for (const entryPoint of entryPoints) {
    for (let i = startChunk; i < startChunk + maxChunks; i++) {
      if (Date.now() > deadline) {
        return {
          transfers,
          chunksScanned: startChunk + chunksScanned,
          complete: false,
        };
      }

      const toBlock =
        latest - BigInt(i) * CHUNK_SIZE > BigInt(0)
          ? latest - BigInt(i) * CHUNK_SIZE
          : BigInt(0);
      const fromBlock =
        toBlock > CHUNK_SIZE ? toBlock - CHUNK_SIZE + BigInt(1) : BigInt(0);

      let logs;
      try {
        logs = await client.getLogs({
          address: entryPoint,
          event: USER_OP_EVENT,
          args: { sender: wallet },
          fromBlock,
          toBlock,
        });
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
        if (!txHash || seenHashes.has(txHash)) continue;
        seenHashes.add(txHash);

        const blockTimestamp = chunkTimestamp;

        const paymaster = (log.args.paymaster as string | undefined)?.toLowerCase();
        const sponsored = Boolean(paymaster && paymaster !== ZERO);

        transfers.push({
          hash: txHash,
          category: "useroperation",
          value: 0,
          asset: "ETH",
          from: wallet,
          to: entryPoint.toLowerCase(),
          metadata: {
            blockTimestamp,
            isUserOperation: true,
            isSponsored: sponsored,
            walletParticipated: true,
          },
        });
      }

      if (fromBlock === BigInt(0)) {
        hitGenesis = true;
        break;
      }
    }
  }

  return {
    transfers,
    chunksScanned: startChunk + chunksScanned,
    complete: hitGenesis,
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

/** Scan all EntryPoint history back to genesis (Base App / paymaster txs). */
export async function fetchUserOperationActivityFull(
  address: string
): Promise<AlchemyTransfer[]> {
  return fetchUserOperationActivity(address, {
    timeoutMs: 120_000,
    maxChunks: 100,
  });
}
