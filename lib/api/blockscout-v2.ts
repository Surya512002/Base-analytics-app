import type { AlchemyTransfer } from "@/lib/types/wallet";

const BLOCKSCOUT_V2 = "https://base.blockscout.com/api/v2";

type BlockscoutAddress = { hash?: string } | null;

interface Paginated<T> {
  items?: T[];
  next_page_params?: Record<string, string | number | null> | null;
}

async function fetchBlockscoutPages<T>(
  basePath: string,
  maxPages = 40,
  deadlineMs = 45_000
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

/** Blockscout v2 supplement — token + internal + external (smart wallet / Base App). */
export async function fetchBlockscoutV2Activity(
  address: string
): Promise<AlchemyTransfer[]> {
  const addr = address.toLowerCase();
  const base = `/addresses/${addr}`;

  try {
    const [tokens, internals, externals] = await Promise.all([
      fetchBlockscoutPages<Parameters<typeof mapTokenTransfer>[0]>(
        `${base}/token-transfers`,
        40,
        45_000
      ),
      fetchBlockscoutPages<Parameters<typeof mapInternalTx>[0]>(
        `${base}/internal-transactions`,
        40,
        45_000
      ),
      fetchBlockscoutPages<Parameters<typeof mapExternalTx>[0]>(
        `${base}/transactions`,
        30,
        45_000
      ),
    ]);

    return [
      ...tokens.map(mapTokenTransfer),
      ...internals.map(mapInternalTx),
      ...externals.map(mapExternalTx),
    ].filter((t): t is AlchemyTransfer => t !== null);
  } catch {
    return [];
  }
}
