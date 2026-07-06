import {
  alchemyRpcForKey,
  getAlchemyKeys,
} from "@/lib/constants/env";
import { fetchNftHoldingsCount } from "@/lib/utils/nft-stats";
import { mergeTransfers } from "@/lib/utils/wallet-activity";
import type { AlchemyResponse, AlchemyTransfer } from "@/lib/types/wallet";

const ALL_CATEGORIES = [
  "external",
  "internal",
  "erc20",
  "erc721",
  "erc1155",
] as const;

type AddressField = "fromAddress" | "toAddress";

interface TransferShard {
  addressField: AddressField;
  categories: readonly string[];
  keyIndex: number;
}

async function fetchAssetTransferPage(
  rpcUrl: string,
  addressField: AddressField,
  address: string,
  categories: readonly string[],
  pageKey?: string,
  timeoutMs = 6_000
): Promise<{
  transfers: AlchemyTransfer[];
  pageKey?: string;
  quotaExceeded: boolean;
}> {
  try {
    const params: Record<string, unknown> = {
      fromBlock: "0x0",
      toBlock: "latest",
      [addressField]: address,
      category: [...categories],
      maxCount: "0x3e8",
      withMetadata: true,
      excludeZeroValue: false,
    };
    if (pageKey) params.pageKey = pageKey;
    const r = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [params],
      }),
    });
    const d = (await r.json()) as AlchemyResponse & {
      error?: { message?: string; code?: number };
    };
    const quotaExceeded =
      Boolean(d.error) &&
      /rate|limit|quota|exceeded|429/i.test(d.error?.message || "");
    const transfers = (d.result?.transfers || []).map((tx) => ({
      ...tx,
      metadata: {
        ...tx.metadata,
        walletParticipated: true,
      },
    }));
    return { transfers, pageKey: d.result?.pageKey, quotaExceeded };
  } catch {
    return { transfers: [], quotaExceeded: false };
  }
}

async function fetchShardTransfers(
  shard: TransferShard,
  address: string,
  keys: string[],
  maxPages: number,
  timeoutMs: number
): Promise<AlchemyTransfer[]> {
  const rpc = alchemyRpcForKey(keys[shard.keyIndex % keys.length]);
  const first = await fetchAssetTransferPage(
    rpc,
    shard.addressField,
    address,
    shard.categories,
    undefined,
    timeoutMs
  );
  if (first.quotaExceeded) return first.transfers;

  const all = [...first.transfers];
  let nextKey = first.pageKey;
  let page = 2;
  while (nextKey && page <= maxPages) {
    const res = await fetchAssetTransferPage(
      rpc,
      shard.addressField,
      address,
      shard.categories,
      nextKey,
      timeoutMs
    );
    if (res.quotaExceeded) break;
    all.push(...res.transfers);
    nextKey = res.pageKey;
    page++;
  }
  return all;
}

/** Assign each API key its own parallel pagination stream. */
function buildTransferShards(keyCount: number): TransferShard[] {
  if (keyCount >= 3) {
    return [
      {
        addressField: "fromAddress",
        categories: ["external", "internal"],
        keyIndex: 0,
      },
      {
        addressField: "fromAddress",
        categories: ["erc20", "erc721", "erc1155"],
        keyIndex: 1,
      },
      {
        addressField: "toAddress",
        categories: ALL_CATEGORIES,
        keyIndex: 2,
      },
    ];
  }
  if (keyCount === 2) {
    return [
      {
        addressField: "fromAddress",
        categories: ALL_CATEGORIES,
        keyIndex: 0,
      },
      {
        addressField: "toAddress",
        categories: ALL_CATEGORIES,
        keyIndex: 1,
      },
    ];
  }
  return [
    {
      addressField: "fromAddress",
      categories: ALL_CATEGORIES,
      keyIndex: 0,
    },
    {
      addressField: "toAddress",
      categories: ALL_CATEGORIES,
      keyIndex: 0,
    },
  ];
}

/**
 * Fetch wallet transfers using every Alchemy key in parallel.
 * With 3+ keys: outgoing ETH/internal, outgoing tokens/NFTs, and incoming each
 * run on a dedicated key at the same time.
 */
export async function fetchAlchemyTxsMultiKey(
  address: string,
  options: { maxPagesPerShard?: number; timeoutMs?: number } = {}
): Promise<AlchemyTransfer[]> {
  const keys = getAlchemyKeys();
  if (!keys.length) return [];

  const shards = buildTransferShards(keys.length);
  const maxPages =
    options.maxPagesPerShard ??
    (keys.length >= 3 ? 3 : keys.length >= 2 ? 3 : 2);
  const timeoutMs = options.timeoutMs ?? 5_000;

  const results = await Promise.all(
    shards.map((shard) =>
      fetchShardTransfers(shard, address, keys, maxPages, timeoutMs).catch(
        () => [] as AlchemyTransfer[]
      )
    )
  );
  return mergeTransfers(results);
}

export async function fetchAlchemyTxsFast(
  address: string,
  maxPages = 6
): Promise<AlchemyTransfer[]> {
  const keys = getAlchemyKeys();
  if (keys.length >= 2) {
    return fetchAlchemyTxsMultiKey(address, { maxPagesPerShard: maxPages });
  }
  return fetchShardTransfers(
    { addressField: "fromAddress", categories: ALL_CATEGORIES, keyIndex: 0 },
    address,
    keys,
    maxPages,
    5_000
  );
}

export async function fetchAlchemyTxsIncoming(
  address: string,
  maxPages = 6
): Promise<AlchemyTransfer[]> {
  const keys = getAlchemyKeys();
  return fetchShardTransfers(
    {
      addressField: "toAddress",
      categories: ALL_CATEGORIES,
      keyIndex: keys.length > 1 ? 1 : 0,
    },
    address,
    keys,
    maxPages,
    5_000
  );
}

export async function fetchNftCount(address: string): Promise<number> {
  return fetchNftHoldingsCount(address);
}
