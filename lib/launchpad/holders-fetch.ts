const BASE_CHAIN_ID = 8453;

export type HolderRow = {
  address: string;
  quantity: string;
  balance: number;
  pctSupply: number;
  valueUsd: number;
  tag: string;
};

function isAddressLike(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

function etherscanV2Url(apiKey: string, params: Record<string, string>): string {
  const q = new URLSearchParams({
    chainid: String(BASE_CHAIN_ID),
    ...params,
    apikey: apiKey,
  });
  return `https://api.etherscan.io/v2/api?${q.toString()}`;
}

type BasescanHolderRow = {
  TokenHolderAddress?: string;
  TokenHolderQuantity?: string;
};

async function fetchBasescanHolders(
  token: string,
  apiKey: string,
  offset: number
): Promise<BasescanHolderRow[] | null> {
  const url = etherscanV2Url(apiKey, {
    module: "token",
    action: "tokenholderlist",
    contractaddress: token,
    page: "1",
    offset: String(offset),
  });

  const r = await fetch(url, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(12_000),
  });
  const data = (await r.json()) as {
    status?: string;
    result?: BasescanHolderRow[] | string;
  };

  if (!r.ok || !Array.isArray(data.result)) return null;
  return data.result;
}

type BlockscoutHolder = {
  address?: { hash?: string };
  value?: string;
};

async function fetchBlockscoutHolders(
  token: string,
  offset: number
): Promise<BlockscoutHolder[] | null> {
  const url = `https://base.blockscout.com/api/v2/tokens/${token}/holders?items_count=${offset}`;
  const r = await fetch(url, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(12_000),
    headers: { Accept: "application/json" },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { items?: BlockscoutHolder[] };
  return data.items ?? null;
}

export function mapHolderRows(input: {
  rows: { address: string; quantity: string }[];
  decimals: number;
  supplyCap: number;
  priceUsd: number;
  pool?: string;
  creator?: string;
}): HolderRow[] {
  const pool = input.pool?.toLowerCase();
  const creator = input.creator?.toLowerCase();

  return input.rows
    .map((row) => {
      const address = row.address;
      const quantity = row.quantity;
      let balance = 0;
      try {
        balance = Number(BigInt(quantity)) / 10 ** input.decimals;
      } catch {
        balance = 0;
      }
      const pctSupply = input.supplyCap > 0 ? (balance / input.supplyCap) * 100 : 0;
      const valueUsd = input.priceUsd > 0 ? balance * input.priceUsd : 0;
      const addrLower = address.toLowerCase();
      let tag = "Wallet";
      if (pool && addrLower === pool) tag = "Pool liquidity";
      else if (creator && addrLower === creator) tag = "Creator";

      return { address, quantity, balance, pctSupply, valueUsd, tag };
    })
    .filter((h) => isAddressLike(h.address));
}

export async function fetchTokenHolders(input: {
  token: string;
  offset: number;
  basescanKey?: string;
}): Promise<{
  rows: { address: string; quantity: string }[];
  source: "basescan" | "blockscout" | "none";
  error?: string;
}> {
  const token = input.token.toLowerCase();

  if (input.basescanKey) {
    try {
      const result = await fetchBasescanHolders(token, input.basescanKey, input.offset);
      if (result?.length) {
        const rows = result
          .map((row) => ({
            address: row.TokenHolderAddress || "",
            quantity: row.TokenHolderQuantity || "0",
          }))
          .filter((r) => isAddressLike(r.address));
        if (rows.length) return { rows, source: "basescan" };
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const items = await fetchBlockscoutHolders(token, input.offset);
    if (items?.length) {
      const rows = items
        .map((item) => ({
          address: item.address?.hash || "",
          quantity: item.value || "0",
        }))
        .filter((r) => isAddressLike(r.address));
      if (rows.length) return { rows, source: "blockscout" };
    }
  } catch {
    /* fall through */
  }

  return {
    rows: [],
    source: "none",
    error: input.basescanKey
      ? "Holders unavailable from BaseScan and Blockscout"
      : "Missing BaseScan API key — Blockscout fallback returned no data",
  };
}
