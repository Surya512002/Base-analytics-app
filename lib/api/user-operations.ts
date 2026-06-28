import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { base } from "viem/chains";
import { ENTRYPOINT_V06, ENTRYPOINT_V07 } from "@/lib/constants/contracts";
import { BASE_RPC } from "@/lib/constants/env";
import type { AlchemyTransfer } from "@/lib/types/wallet";

const ZERO = "0x0000000000000000000000000000000000000000";
const CHUNK_SIZE = BigInt(3_000_000);

const USER_OP_EVENT = parseAbiItem(
  "event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)"
);

export interface UserOpFetchOptions {
  /** Abort RPC scan after this many ms (non-fatal). */
  timeoutMs?: number;
  /** How many block chunks to scan per EntryPoint (newest first). */
  maxChunks?: number;
}

async function fetchUserOpLogs(
  address: string,
  options: UserOpFetchOptions
): Promise<AlchemyTransfer[]> {
  if (!BASE_RPC) return [];

  const wallet = address.toLowerCase() as Address;
  const client = createPublicClient({ chain: base, transport: http(BASE_RPC) });
  const entryPoints = [ENTRYPOINT_V06, ENTRYPOINT_V07] as Address[];
  const blockTimestampCache = new Map<bigint, string>();
  const transfers: AlchemyTransfer[] = [];
  const seenHashes = new Set<string>();
  const maxChunks = options.maxChunks ?? 8;
  const deadline = Date.now() + (options.timeoutMs ?? 12_000);

  let latest: bigint;
  try {
    latest = await client.getBlockNumber();
  } catch {
    return [];
  }

  for (const entryPoint of entryPoints) {
    for (let i = 0; i < maxChunks; i++) {
      if (Date.now() > deadline) return transfers;

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

      for (const log of logs) {
        const txHash = log.transactionHash;
        if (!txHash || seenHashes.has(txHash)) continue;
        seenHashes.add(txHash);

        const blockNumber = log.blockNumber;
        if (blockNumber == null) continue;

        let blockTimestamp = blockTimestampCache.get(blockNumber);
        if (!blockTimestamp) {
          try {
            const block = await client.getBlock({ blockNumber });
            blockTimestamp = new Date(
              Number(block.timestamp) * 1000
            ).toISOString();
            blockTimestampCache.set(blockNumber, blockTimestamp);
          } catch {
            blockTimestamp = new Date().toISOString();
          }
        }

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
          },
        });
      }

      if (fromBlock === BigInt(0)) break;
    }
  }

  return transfers;
}

/** ERC-4337 UserOperations — Base App / Coinbase Paymaster gasless txs. */
export async function fetchUserOperationActivity(
  address: string,
  options: UserOpFetchOptions = {}
): Promise<AlchemyTransfer[]> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  return Promise.race([
    fetchUserOpLogs(address, options),
    new Promise<AlchemyTransfer[]>((resolve) =>
      setTimeout(() => resolve([]), timeoutMs)
    ),
  ]);
}
