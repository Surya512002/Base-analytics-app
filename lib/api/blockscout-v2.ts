import type { AlchemyTransfer } from "@/lib/types/wallet";

const BLOCKSCOUT_V2 = "https://base.blockscout.com/api/v2";

type BlockscoutAddress = { hash?: string } | null;

interface Paginated<T> {
  items?: T[];
  next_page_params?: Record<string, string | number | null> | null;
}

export interface BlockscoutFetchOptions {
  tokenPages?: number;
  internalPages?: number;
  externalPages?: number;
  deadlineMs?: number;
}

async function fetchBlockscoutPages<T>(
  basePath: string,
  maxPages = 6,
  deadlineMs = 28000
): Promise<T[]> {
  const all: T[] = [];
  let path = basePath;
  const started = Date.now();

  for (let page = 0; page < maxPages; page++) {
    if (Date.now() - started > deadlineMs) break;

    const res = await fetch(`${BLOCKSCOUT_V2}${path}`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) break;

    const data = (await res.json()) as Paginated<T>;
    if (!Array.isArray(data.items) || data.items.length === 0) break;
    all.push(...data.items);

    const next = data.next_page_params;
    if (!next || typeof next !== "object") break;

    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value != null && value !== "") qs.set(key, String(value));
    }
    path = `${basePath}?${qs.toString()}`;
  }

  return all;
}

function addrHash(entry: BlockscoutAddress | undefined): string {
  return (entry?.hash || "").toLowerCase();
}

function normalizeAddr(addr: string | null | undefined): string {
  return (addr || "").toLowerCase();
}

function mapTokenTransfer(item: {
  transaction_hash?: string;
  timestamp?: string;
  from?: BlockscoutAddress;
  to?: BlockscoutAddress;
  token?: { symbol?: string | null; decimals?: string | null };
  total?: { value?: string | null; decimals?: string | null };
}): AlchemyTransfer | null {
  if (!item.transaction_hash || !item.timestamp) return null;
  const decimals = Number(item.total?.decimals ?? item.token?.decimals ?? 18);
  const raw = item.total?.value ?? "0";
  let value = 0;
  try {
    value = Number(raw) / 10 ** (Number.isFinite(decimals) ? decimals : 18);
  } catch {
    value = 0;
  }

  return {
    hash: item.transaction_hash,
    category: "erc20",
    value,
    asset: item.token?.symbol || "TOKEN",
    from: addrHash(item.from) || null,
    to: addrHash(item.to) || null,
    metadata: { blockTimestamp: item.timestamp },
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
    metadata: { blockTimestamp: item.timestamp },
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
    metadata: { blockTimestamp: item.timestamp },
  };
}

/** Blockscout v2 — token transfers + internal txs (critical for Base App / smart wallets). */
export async function fetchBlockscoutV2Activity(
  address: string,
  options: BlockscoutFetchOptions = {}
): Promise<AlchemyTransfer[]> {
  const addr = address.toLowerCase();
  const base = `/addresses/${addr}`;
  const tokenPages = options.tokenPages ?? 30;
  const internalPages = options.internalPages ?? 25;
  const externalPages = options.externalPages ?? 15;
  const deadlineMs = options.deadlineMs ?? 28000;

  try {
    const [tokens, internals, externals] = await Promise.all([
      fetchBlockscoutPages<Parameters<typeof mapTokenTransfer>[0]>(
        `${base}/token-transfers`,
        tokenPages,
        deadlineMs
      ),
      fetchBlockscoutPages<Parameters<typeof mapInternalTx>[0]>(
        `${base}/internal-transactions`,
        internalPages,
        deadlineMs
      ),
      fetchBlockscoutPages<Parameters<typeof mapExternalTx>[0]>(
        `${base}/transactions`,
        externalPages,
        deadlineMs
      ),
    ]);

    const mapped = [
      ...tokens.map(mapTokenTransfer),
      ...internals.map(mapInternalTx),
      ...externals.map(mapExternalTx),
    ].filter((t): t is AlchemyTransfer => t !== null);

    // Ensure every tx hash with wallet-initiated internal/outgoing activity counts once.
    const walletTxHashes = new Set<string>();
    for (const tx of mapped) {
      if (normalizeAddr(tx.from) === addr) walletTxHashes.add(tx.hash);
    }
    for (const hash of walletTxHashes) {
      const sample = mapped.find((t) => t.hash === hash);
      if (!sample?.metadata?.blockTimestamp) continue;
      if (mapped.some((t) => t.hash === hash && t.category === "contractcall"))
        continue;
      mapped.push({
        hash,
        category: "contractcall",
        value: 0,
        asset: "ETH",
        from: addr,
        to: null,
        metadata: { blockTimestamp: sample.metadata.blockTimestamp },
      });
    }

    return mapped;
  } catch {
    return [];
  }
}
