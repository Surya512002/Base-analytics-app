import type { AlchemyTransfer } from "@/lib/types/wallet";
import { getAddress } from "viem";

const BLOCKSCOUT_V2 = "https://base.blockscout.com/api/v2";

export type V2Stream =
  | "token-transfers"
  | "internal-transactions"
  | "transactions";

type BlockscoutAddress = { hash?: string } | null;

interface Paginated<T> {
  items?: T[];
  next_page_params?: Record<string, string | number | null> | null;
}

export interface V2ChunkResult {
  transfers: AlchemyTransfer[];
  nextCursor: string | null;
  done: boolean;
  pagesFetched: number;
}

function normalizeAddr(addr: string | null | undefined): string {
  return (addr || "").toLowerCase();
}

/** Blockscout v2 URL paths require EIP-55 checksum — lowercase returns 422. */
function blockscoutPathAddress(address: string): string {
  try {
    return getAddress(address);
  } catch {
    return address;
  }
}

export function encodeV2Cursor(
  params: Record<string, string | number | null>
): string {
  return Buffer.from(JSON.stringify(params)).toString("base64url");
}

export function decodeV2Cursor(
  raw: string
): Record<string, string | number | null> | null {
  try {
    return JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    ) as Record<string, string | number | null>;
  } catch {
    return null;
  }
}

function buildPath(
  basePath: string,
  cursor: Record<string, string | number | null> | null
): string {
  if (!cursor) return basePath;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(cursor)) {
    if (value != null && value !== "") qs.set(key, String(value));
  }
  const q = qs.toString();
  return q ? `${basePath}?${q}` : basePath;
}

export interface V2StreamState {
  complete: boolean;
  cursor: string | null;
}

async function fetchBlockscoutPages<T>(
  basePath: string,
  maxPages: number,
  deadlineMs: number,
  pageTimeoutMs = 8_000
): Promise<{ items: T[]; exhausted: boolean; resumeCursor: string | null }> {
  const all: T[] = [];
  let path = basePath;
  const started = Date.now();
  const bounded = deadlineMs > 0;
  let lastNext: Record<string, string | number | null> | null = null;

  for (let page = 0; page < maxPages; page++) {
    if (bounded && page > 0 && Date.now() - started >= deadlineMs) {
      return {
        items: all,
        exhausted: false,
        resumeCursor: lastNext ? encodeV2Cursor(lastNext) : null,
      };
    }

    try {
      const res = await fetch(`${BLOCKSCOUT_V2}${path}`, {
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(pageTimeoutMs),
      });
      if (!res.ok) {
        return {
          items: all,
          exhausted: false,
          resumeCursor: lastNext ? encodeV2Cursor(lastNext) : null,
        };
      }

      const data = (await res.json()) as Paginated<T>;
      if (!Array.isArray(data.items) || data.items.length === 0) {
        return { items: all, exhausted: true, resumeCursor: null };
      }
      all.push(...data.items);

      const next = data.next_page_params;
      if (!next || typeof next !== "object") {
        return { items: all, exhausted: true, resumeCursor: null };
      }
      lastNext = next;

      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) {
        if (value != null && value !== "") qs.set(key, String(value));
      }
      path = `${basePath}?${qs.toString()}`;
    } catch {
      return {
        items: all,
        exhausted: false,
        resumeCursor: lastNext ? encodeV2Cursor(lastNext) : null,
      };
    }
  }

  return {
    items: all,
    exhausted: false,
    resumeCursor: lastNext ? encodeV2Cursor(lastNext) : null,
  };
}

function addrHash(entry: BlockscoutAddress | undefined): string {
  return (entry?.hash || "").toLowerCase();
}

function nftCategoryFromType(
  type: string | null | undefined
): "erc721" | "erc1155" | null {
  const t = (type || "").toUpperCase();
  if (t.includes("721")) return "erc721";
  if (t.includes("1155")) return "erc1155";
  return null;
}

function mapTokenTransfer(item: {
  transaction_hash?: string;
  timestamp?: string;
  from?: BlockscoutAddress;
  to?: BlockscoutAddress;
  token?: {
    symbol?: string | null;
    decimals?: string | null;
    address_hash?: string | null;
    type?: string | null;
  };
  total?: {
    value?: string | null;
    decimals?: string | null;
    token_id?: string | null;
  };
}): AlchemyTransfer | null {
  if (!item.transaction_hash || !item.timestamp) return null;
  const nftCat = nftCategoryFromType(item.token?.type);
  const decimals = Number(item.total?.decimals ?? item.token?.decimals ?? 18);
  const raw = item.total?.value ?? "0";
  let value = 0;
  try {
    value = Number(raw) / 10 ** (Number.isFinite(decimals) ? decimals : 18);
  } catch {
    value = 0;
  }

  const contract = (item.token?.address_hash || "").toLowerCase();
  const tokenId = item.total?.token_id;
  const asset = nftCat
    ? contract && tokenId != null
      ? `${contract}#${tokenId}`
      : contract || item.token?.symbol || "NFT"
    : contract || item.token?.symbol || "TOKEN";

  return {
    hash: item.transaction_hash,
    category: nftCat || "erc20",
    value: nftCat ? (value > 0 ? value : 1) : value,
    asset,
    from: addrHash(item.from) || null,
    to: addrHash(item.to) || null,
    metadata: { blockTimestamp: item.timestamp, walletParticipated: true },
  };
}

function mapInternalTx(item: {
  transaction_hash?: string;
  timestamp?: string;
  from?: BlockscoutAddress;
  to?: BlockscoutAddress;
  value?: string | null;
}): AlchemyTransfer | null {
  if (!item.transaction_hash || !item.timestamp) return null;
  const wei = item.value ? BigInt(item.value) : BigInt(0);
  const eth = Number(wei) / 1e18;

  return {
    hash: item.transaction_hash,
    category: "internal",
    value: eth,
    asset: "ETH",
    from: addrHash(item.from) || null,
    to: addrHash(item.to) || null,
    metadata: {
      blockTimestamp: item.timestamp,
      isSponsored: eth === 0 && Boolean(item.from && item.to),
      walletParticipated: true,
    },
  };
}

function mapExternalTx(item: {
  hash?: string;
  timestamp?: string;
  from?: BlockscoutAddress;
  to?: BlockscoutAddress;
  value?: string | null;
}): AlchemyTransfer | null {
  if (!item.hash || !item.timestamp) return null;
  const wei = item.value ? BigInt(item.value) : BigInt(0);
  const eth = Number(wei) / 1e18;

  return {
    hash: item.hash,
    category: "external",
    value: eth,
    asset: "ETH",
    from: addrHash(item.from) || null,
    to: addrHash(item.to) || null,
    metadata: {
      blockTimestamp: item.timestamp,
      walletParticipated: true,
    },
  };
}

function mapStreamItems(
  stream: V2Stream,
  items: unknown[]
): AlchemyTransfer[] {
  if (stream === "token-transfers") {
    return items
      .map((item) => mapTokenTransfer(item as Parameters<typeof mapTokenTransfer>[0]))
      .filter((t): t is AlchemyTransfer => t !== null);
  }
  if (stream === "internal-transactions") {
    return items
      .map((item) => mapInternalTx(item as Parameters<typeof mapInternalTx>[0]))
      .filter((t): t is AlchemyTransfer => t !== null);
  }
  return items
    .map((item) => mapExternalTx(item as Parameters<typeof mapExternalTx>[0]))
    .filter((t): t is AlchemyTransfer => t !== null);
}

/** Ensure every tx hash from address-scoped data counts toward active days. */
function addSyntheticActivityLegs(
  mapped: AlchemyTransfer[],
  addr: string
): AlchemyTransfer[] {
  const byHash = new Map<string, AlchemyTransfer>();
  for (const tx of mapped) {
    if (tx.hash && tx.metadata?.blockTimestamp) byHash.set(tx.hash, tx);
  }

  for (const [hash, sample] of byHash) {
    const walletOnLeg = mapped.some(
      (t) =>
        t.hash === hash &&
        (normalizeAddr(t.from) === addr || normalizeAddr(t.to) === addr)
    );
    if (walletOnLeg) continue;
    mapped.push({
      hash,
      category: "contractcall",
      value: 0,
      asset: "ETH",
      from: addr,
      to: null,
      metadata: {
        blockTimestamp: sample.metadata.blockTimestamp,
        walletParticipated: true,
      },
    });
  }

  return mapped;
}

/** Paginate one v2 stream — used for progressive background sync. */
export async function fetchBlockscoutV2Chunk(
  address: string,
  stream: V2Stream,
  cursor: Record<string, string | number | null> | null = null,
  maxPages = 15
): Promise<V2ChunkResult> {
  const addr = address.toLowerCase();
  const pathAddr = blockscoutPathAddress(address);
  const basePath = `/addresses/${pathAddr}/${stream}`;
  let path = buildPath(basePath, cursor);
  const items: unknown[] = [];
  let pagesFetched = 0;
  let nextCursor: string | null = null;
  let done = false;

  for (let page = 0; page < maxPages; page++) {
    let res: Response;
    try {
      res = await fetch(`${BLOCKSCOUT_V2}${path}`, {
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      break;
    }
    if (res.status === 429) break;
    if (!res.ok) break;

    const data = (await res.json()) as Paginated<unknown>;
    const next = data.next_page_params;
    if (!Array.isArray(data.items) || data.items.length === 0) {
      if (!next || typeof next !== "object") {
        done = true;
      } else {
        nextCursor = encodeV2Cursor(next);
        path = buildPath(basePath, next);
      }
      break;
    }
    items.push(...data.items);
    pagesFetched++;

    if (!next || typeof next !== "object") {
      done = true;
      break;
    }

    nextCursor = encodeV2Cursor(next);
    path = buildPath(basePath, next);
  }

  const mapped = mapStreamItems(stream, items);
  return {
    transfers: addSyntheticActivityLegs(mapped, addr),
    nextCursor: done ? null : nextCursor,
    done,
    pagesFetched,
  };
}

export interface V2FetchOptions {
  tokenPages?: number;
  internalPages?: number;
  externalPages?: number;
  deadlineMs?: number;
  pageTimeoutMs?: number;
  /** Run streams one-by-one to avoid Blockscout rate limits on connect. */
  sequentialStreams?: boolean;
}

export async function fetchBlockscoutV2Activity(
  address: string,
  options: V2FetchOptions = {}
): Promise<{
  transfers: AlchemyTransfer[];
  complete: boolean;
  streamStates: Record<V2Stream, V2StreamState>;
}> {
  const tokenPages = options.tokenPages ?? 40;
  const internalPages = options.internalPages ?? 40;
  const externalPages = options.externalPages ?? 30;
  const deadlineMs = options.deadlineMs ?? 45_000;
  const pageTimeoutMs = options.pageTimeoutMs ?? 8_000;
  const addr = address.toLowerCase();
  const pathAddr = blockscoutPathAddress(address);
  const base = `/addresses/${pathAddr}`;

  const emptyStates: Record<V2Stream, V2StreamState> = {
    "token-transfers": { complete: false, cursor: null },
    "internal-transactions": { complete: false, cursor: null },
    transactions: { complete: false, cursor: null },
  };

  try {
    const sequential = options.sequentialStreams ?? false;

    const fetchStream = (path: string, pages: number) => {
      if (pages <= 0) {
        return Promise.resolve({
          items: [] as unknown[],
          exhausted: false,
          resumeCursor: null as string | null,
        });
      }
      return fetchBlockscoutPages<unknown>(
        path,
        pages,
        deadlineMs,
        pageTimeoutMs
      );
    };

    let tokens: Awaited<ReturnType<typeof fetchStream>>;
    let internals: typeof tokens;
    let externals: typeof tokens;

    if (sequential) {
      tokens = await fetchStream(`${base}/token-transfers`, tokenPages);
      internals = await fetchStream(
        `${base}/internal-transactions`,
        internalPages
      );
      externals = await fetchStream(`${base}/transactions`, externalPages);
    } else {
      [tokens, internals, externals] = await Promise.all([
        fetchStream(`${base}/token-transfers`, tokenPages),
        fetchStream(`${base}/internal-transactions`, internalPages),
        fetchStream(`${base}/transactions`, externalPages),
      ]);
    }

    const mapped = [
      ...tokens.items.map((item) =>
        mapTokenTransfer(item as Parameters<typeof mapTokenTransfer>[0])
      ),
      ...internals.items.map((item) =>
        mapInternalTx(item as Parameters<typeof mapInternalTx>[0])
      ),
      ...externals.items.map((item) =>
        mapExternalTx(item as Parameters<typeof mapExternalTx>[0])
      ),
    ].filter((t): t is AlchemyTransfer => t !== null);

    const streamStates: Record<V2Stream, V2StreamState> = {
      "token-transfers": {
        complete: tokens.exhausted,
        cursor: tokens.exhausted ? null : tokens.resumeCursor,
      },
      "internal-transactions": {
        complete: internalPages <= 0 ? false : internals.exhausted,
        cursor:
          internalPages <= 0 || internals.exhausted
            ? null
            : internals.resumeCursor,
      },
      transactions: {
        complete: externalPages <= 0 ? false : externals.exhausted,
        cursor:
          externalPages <= 0 || externals.exhausted
            ? null
            : externals.resumeCursor,
      },
    };

    const complete =
      streamStates["token-transfers"].complete &&
      streamStates["internal-transactions"].complete &&
      streamStates.transactions.complete;

    return {
      transfers: addSyntheticActivityLegs(mapped, addr),
      complete,
      streamStates,
    };
  } catch {
    return { transfers: [], complete: false, streamStates: emptyStates };
  }
}

export const V2_STREAMS: V2Stream[] = [
  "token-transfers",
  "internal-transactions",
  "transactions",
];
