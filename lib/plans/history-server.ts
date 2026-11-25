import { fillsFromLogs, type PlanFill, type RawLog } from "@/limit-orders/shared/planHistory";

/**
 * A wallet's plan runs on Base. Free log queries only reach a few blocks, so instead we ask Alchemy
 * which transactions moved tokens from the order book to the wallet (an address index, any age), then
 * read the contract's own events from those receipts.
 */

export const MAX_PAGES = 3;
export const MAX_RECEIPTS = 300;
const BATCH = 25;
const CACHE_MAX = 3000;

type RpcCall = { method: string; params: unknown[] };
export interface HistoryDeps {
  /** Send a JSON-RPC batch; results come back in the same order, null for a call that failed. Throws if the request fails. */
  rpcBatch(calls: RpcCall[]): Promise<unknown[]>;
}

type Receipt = { logs: RawLog[]; status?: string };
// A mined receipt never changes, so it is safe to keep.
const receipts = new Map<string, Receipt>();

export function alchemyDeps(url: string): HistoryDeps {
  return {
    async rpcBatch(calls) {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: "2.0", id, ...c }))),
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`RPC ${r.status}`);
      const body = (await r.json()) as Array<{ id: number; result?: unknown; error?: unknown }>;
      if (!Array.isArray(body)) throw new Error("RPC returned no batch");
      const out: unknown[] = calls.map(() => null);
      for (const item of body) if (!item.error && item.id >= 0 && item.id < out.length) out[item.id] = item.result ?? null;
      return out;
    },
  };
}

export async function loadPlanHistory(a: { orderBook: string; owner: string }, deps: HistoryDeps): Promise<{ fills: PlanFill[]; partial: boolean }> {
  const times = new Map<string, number | null>();
  let pageKey: string | undefined;
  let partial = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const [res] = await deps.rpcBatch([
      {
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            fromAddress: a.orderBook,
            toAddress: a.owner,
            category: ["erc20"],
            order: "desc",
            maxCount: "0x3e8",
            withMetadata: true,
            excludeZeroValue: true,
            ...(pageKey ? { pageKey } : {}),
          },
        ],
      },
    ]);
    if (!res) throw new Error("transfer lookup failed");
    const data = res as { transfers?: Array<{ hash: string; metadata?: { blockTimestamp?: string } }>; pageKey?: string };
    for (const t of data.transfers ?? []) {
      if (times.has(t.hash)) continue;
      const ms = t.metadata?.blockTimestamp ? Date.parse(t.metadata.blockTimestamp) : NaN;
      times.set(t.hash, Number.isFinite(ms) ? Math.floor(ms / 1000) : null);
    }
    pageKey = data.pageKey;
    if (!pageKey) break;
    if (page === MAX_PAGES - 1) partial = true;
  }

  let hashes = [...times.keys()]; // newest first
  if (hashes.length > MAX_RECEIPTS) {
    hashes = hashes.slice(0, MAX_RECEIPTS);
    partial = true;
  }

  const missing = hashes.filter((h) => !receipts.has(h));
  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH);
    const got = await deps.rpcBatch(chunk.map((h) => ({ method: "eth_getTransactionReceipt", params: [h] })));
    chunk.forEach((h, j) => {
      const r = got[j] as Receipt | null;
      if (!r || !Array.isArray(r.logs)) {
        partial = true;
        return;
      }
      if (receipts.size >= CACHE_MAX) receipts.delete(receipts.keys().next().value as string);
      receipts.set(h, r);
    });
  }

  const fills = hashes.flatMap((h) => {
    const r = receipts.get(h);
    return r ? fillsFromLogs(r.logs, a.orderBook, a.owner, h, times.get(h) ?? null) : [];
  });
  return { fills, partial };
}
