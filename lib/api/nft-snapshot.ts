import { getAddress } from "viem";
import {
  countNftActivityFromTransfers,
  countNftTxHashesFromTransfers,
  estimateNftHoldingsFromTransfers,
  fetchAlchemyNftTotalCount,
  fetchNftHoldingsCount,
} from "@/lib/utils/nft-stats";
import {
  fetchBlockscoutNftHoldingsCount,
  fetchBlockscoutNftTxHashCount,
} from "@/lib/api/blockscout-nft-metrics";
import { fetchBlockscoutNftBundle } from "@/lib/api/blockscout-parallel";
import type { AlchemyTransfer } from "@/lib/types/wallet";

export interface NftSnapshot {
  nftCount: number;
  nftTxCount: number;
  mintCount: number;
  transfers: AlchemyTransfer[];
}

export interface NftSnapshotOptions {
  quick?: boolean;
}

/** NFT metrics from Blockscout (holdings + transfer history). */
export async function fetchNftSnapshot(
  address: string,
  existingTxs: AlchemyTransfer[] = [],
  options: NftSnapshotOptions = {}
): Promise<NftSnapshot> {
  const addr = address.toLowerCase();
  const quick = options.quick ?? false;

  if (quick) {
    const [alchemyCount, blockscoutHeld, nftTransfers] = await Promise.all([
      fetchAlchemyNftTotalCount(address).catch(() => 0),
      fetchBlockscoutNftHoldingsCount(address, {
        maxPages: 2,
        deadlineMs: 3_500,
      }).catch(() => 0),
      fetchBlockscoutNftBundle(addr, 1).catch(() => [] as AlchemyTransfer[]),
    ]);
    const merged = [...existingTxs, ...nftTransfers];
    const fromTransfers = countNftActivityFromTransfers(merged, addr);
    const holdings = estimateNftHoldingsFromTransfers(merged, addr);
    const { uniqueHashes, mintHashes } = countNftTxHashesFromTransfers(
      merged,
      addr
    );
    return {
      nftCount: Math.max(alchemyCount, blockscoutHeld, fromTransfers, holdings),
      nftTxCount: Math.max(
        uniqueHashes,
        mintHashes,
        new Set(nftTransfers.map((t) => t.hash.toLowerCase())).size
      ),
      mintCount: mintHashes,
      transfers: nftTransfers,
    };
  }

  const bundlePages = 15;
  const metricsPages = 30;
  const metricsDeadline = 16_000;

  const [nftTransfers, blockscoutHeld, alchemyCount] = await Promise.all([
    fetchBlockscoutNftBundle(addr, bundlePages),
    fetchBlockscoutNftHoldingsCount(address, {
      maxPages: metricsPages,
      deadlineMs: metricsDeadline,
    }),
    fetchNftHoldingsCount(address).catch(() => 0),
  ]);

  const blockscoutTxHashes = await fetchBlockscoutNftTxHashCount(address, {
    maxPages: metricsPages,
    deadlineMs: metricsDeadline,
  });

  const merged = [...existingTxs, ...nftTransfers];
  const fromTransfers = countNftActivityFromTransfers(merged, addr);
  const holdings = estimateNftHoldingsFromTransfers(merged, addr);
  const { uniqueHashes, mintHashes } = countNftTxHashesFromTransfers(
    merged,
    addr
  );

  const nftCount = Math.max(
    blockscoutHeld,
    alchemyCount,
    fromTransfers,
    holdings
  );
  const nftTxCount = Math.max(
    uniqueHashes,
    mintHashes,
    blockscoutTxHashes,
    new Set(nftTransfers.map((t) => t.hash.toLowerCase())).size
  );

  return {
    nftCount,
    nftTxCount,
    mintCount: mintHashes,
    transfers: nftTransfers,
  };
}
