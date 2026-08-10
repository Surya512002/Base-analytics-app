import {
  alchemyRpcForKey,
  getAlchemyKey,
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

/** Full category set — includes internal for contract self-calls / AA legs. */
const CONNECT_CATEGORIES = [
  "external",
  "internal",
  "erc20",
  "erc721",
  "erc1155",
] as const;

export async function fetchAlchemyTxsUnified(
  address: string,
  options: {
    addressField?: AddressField;
    categories?: readonly string[];
    maxPages?: number;
    timeoutMs?: number;
    /** Hard wall for multi-page loops (ms from now). */
    budgetMs?: number;
  } = {}
): Promise<AlchemyTransfer[]> {
  const key = getAlchemyKey();
  if (!key) return [];

  const rpc = alchemyRpcForKey(key);
  const addressField = options.addressField ?? "fromAddress";
  const categories = options.categories ?? CONNECT_CATEGORIES;
  const maxPages = options.maxPages ?? 20;
  const pageTimeoutMs = options.timeoutMs ?? 4_000;
  const deadline =
    options.budgetMs != null ? Date.now() + options.budgetMs : Number.POSITIVE_INFINITY;

  const all: AlchemyTransfer[] = [];
  let pageKey: string | undefined;
  for (let page = 1; page <= maxPages; page++) {
    if (Date.now() >= deadline) break;
    const remain = Math.max(600, Math.min(pageTimeoutMs, deadline - Date.now()));
    const res = await fetchAssetTransferPage(
      rpc,
      addressField,
      address,
      categories,
      pageKey,
      remain
    );
    all.push(...res.transfers);
    if (res.quotaExceeded || !res.pageKey) break;
    if (res.transfers.length === 0) break;
    pageKey = res.pageKey;
  }
  return all;
}

export interface AlchemyWalletFetchResult {
  transfers: AlchemyTransfer[];
  /** Outgoing pagination exhausted (no more pageKey). */
  outComplete: boolean;
  /** Incoming pagination exhausted. */
  inComplete: boolean;
  /** Resume cursor when outIncomplete. */
  outPageKey: string | null;
  /** Resume cursor when inIncomplete. */
  inPageKey: string | null;
}

/**
 * Paginate one Alchemy address direction until empty, budget, or max pages.
 * Used for connect fetch and background resume.
 */
export async function fetchAlchemyDirection(
  address: string,
  addressField: AddressField,
  options: {
    budgetMs?: number;
    maxPages?: number;
    pageTimeoutMs?: number;
    startPageKey?: string | null;
  } = {}
): Promise<{
  transfers: AlchemyTransfer[];
  complete: boolean;
  pageKey: string | null;
}> {
  const key = getAlchemyKey();
  if (!key) {
    return { transfers: [], complete: false, pageKey: options.startPageKey ?? null };
  }

  const budgetMs = options.budgetMs ?? 12_000;
  const maxPages = options.maxPages ?? 40;
  const pageTimeoutMs = options.pageTimeoutMs ?? 3_500;
  const deadline = Date.now() + budgetMs;
  const rpc = alchemyRpcForKey(key);
  const addr = address.toLowerCase();

  const all: AlchemyTransfer[] = [];
  let pageKey: string | undefined = options.startPageKey ?? undefined;
  // When resuming, startPageKey is the *next* page to fetch.
  for (let page = 1; page <= maxPages; page++) {
    if (Date.now() >= deadline) {
      return {
        transfers: all,
        complete: false,
        pageKey: pageKey ?? null,
      };
    }
    const remain = Math.max(600, Math.min(pageTimeoutMs, deadline - Date.now()));
    const res = await fetchAssetTransferPage(
      rpc,
      addressField,
      addr,
      CONNECT_CATEGORIES,
      pageKey,
      remain
    );
    all.push(...res.transfers);
    if (res.quotaExceeded) {
      return {
        transfers: all,
        complete: false,
        pageKey: res.pageKey ?? pageKey ?? null,
      };
    }
    if (!res.pageKey || res.transfers.length === 0) {
      return { transfers: all, complete: true, pageKey: null };
    }
    pageKey = res.pageKey;
  }
  return {
    transfers: all,
    complete: false,
    pageKey: pageKey ?? null,
  };
}

/**
 * Full address-filtered Alchemy history (from + to) until exhausted or budget.
 * Primary source for paid onchain analysis — no chain-wide scans.
 */
export async function fetchAlchemyWalletComplete(
  address: string,
  options: {
    budgetMs?: number;
    maxPagesPerDirection?: number;
    pageTimeoutMs?: number;
    outPageKey?: string | null;
    inPageKey?: string | null;
  } = {}
): Promise<AlchemyWalletFetchResult> {
  const key = getAlchemyKey();
  if (!key) {
    return {
      transfers: [],
      outComplete: false,
      inComplete: false,
      outPageKey: null,
      inPageKey: null,
    };
  }

  const budgetMs = options.budgetMs ?? 28_000;
  const maxPages = options.maxPagesPerDirection ?? 100;
  const pageTimeoutMs = options.pageTimeoutMs ?? 3_500;
  // Give each direction half the wall (parallel).
  const half = Math.max(4_000, Math.floor(budgetMs / 2));

  const [out, inn] = await Promise.all([
    fetchAlchemyDirection(address, "fromAddress", {
      budgetMs: half,
      maxPages,
      pageTimeoutMs,
      startPageKey: options.outPageKey,
    }),
    fetchAlchemyDirection(address, "toAddress", {
      budgetMs: half,
      maxPages,
      pageTimeoutMs,
      startPageKey: options.inPageKey,
    }),
  ]);

  return {
    transfers: mergeTransfers([out.transfers, inn.transfers]),
    outComplete: out.complete,
    inComplete: inn.complete,
    outPageKey: out.pageKey,
    inPageKey: inn.pageKey,
  };
}

export async function fetchAlchemyTxsFast(
  address: string,
  maxPages = 6
): Promise<AlchemyTransfer[]> {
  const key = getAlchemyKey();
  if (!key) return [];
  return fetchShardTransfers(
    { addressField: "fromAddress", categories: ALL_CATEGORIES, keyIndex: 0 },
    address,
    [key],
    maxPages,
    5_000
  );
}

export async function fetchAlchemyTxsIncoming(
  address: string,
  maxPages = 6
): Promise<AlchemyTransfer[]> {
  const key = getAlchemyKey();
  if (!key) return [];
  return fetchShardTransfers(
    {
      addressField: "toAddress",
      categories: ALL_CATEGORIES,
      keyIndex: 0,
    },
    address,
    [key],
    maxPages,
    5_000
  );
}

export async function fetchNftCount(address: string): Promise<number> {
  return fetchNftHoldingsCount(address);
}
