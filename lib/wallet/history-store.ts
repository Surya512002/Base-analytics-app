import type { AlchemyTransfer } from "@/lib/types/wallet";
import type { V2StreamState } from "@/lib/api/blockscout-v2";
import { cacheGet, cacheSet } from "@/lib/redis-cache";
import {
  countsTowardActivity,
  rollupWalletActivity,
} from "@/lib/utils/wallet-activity";
import { getDayKey } from "@/lib/utils/dates";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const TTL_SECONDS = 86_400;
const TTL_COMPLETE_SECONDS = 604_800;
/** v10: Alchemy resume cursors. Incomplete v2 is reopened in sync-engine. */
const KEY_PREFIX = "wallet-hist:v10";
const FILE_CACHE_DIR = path.join(process.cwd(), ".cache", "wallet-history");

/** In-process fallback when Redis is unavailable — keeps activity days across connects. */
const memHistory = new Map<string, StoredWalletHistory>();

function filePathFor(address: string): string {
  return path.join(FILE_CACHE_DIR, `${address.toLowerCase()}.json`);
}

async function loadFileHistory(
  address: string
): Promise<StoredWalletHistory | null> {
  try {
    const raw = await readFile(filePathFor(address), "utf8");
    return JSON.parse(raw) as StoredWalletHistory;
  } catch {
    return null;
  }
}

async function saveFileHistory(
  address: string,
  state: StoredWalletHistory
): Promise<void> {
  try {
    await mkdir(FILE_CACHE_DIR, { recursive: true });
    await writeFile(filePathFor(address), JSON.stringify(state));
  } catch {
    /* optional disk cache */
  }
}

/** Pick the history snapshot with the most active days. */
function pickRichestHistory(
  ...candidates: (StoredWalletHistory | null | undefined)[]
): StoredWalletHistory | null {
  let best: StoredWalletHistory | null = null;
  let bestDays = -1;
  for (const c of candidates) {
    if (!c) continue;
    const days = Object.entries(c.tpd).filter(([, n]) => n > 0).length;
    if (days > bestDays) {
      bestDays = days;
      best = c;
    }
  }
  return best;
}

export interface StoredWalletHistory {
  v2StreamStates: Record<string, V2StreamState>;
  historyComplete: boolean;
  userOpsFetched: boolean;
  v1SupplementFetched: boolean;
  /** Compact activity index — small enough for Redis. */
  activityDays: string[];
  txHashes: string[];
  /** `${txHash}|${yyyy-mm-dd}` keys — one heatmap count per tx per day. */
  dayTxKeys: string[];
  tpd: Record<string, number>;
  tokenAssets: string[];
  erc20LegCount: number;
  updatedAt: number;
  /** Progressive ERC-4337 scan cursor (chunk index from latest). */
  userOpChunkCursor: number;
  userOpsComplete: boolean;
  /** Alchemy fromAddress pagination. */
  alchemyOutComplete: boolean;
  alchemyInComplete: boolean;
  alchemyOutPageKey: string | null;
  alchemyInPageKey: string | null;
}

function keyFor(address: string): string {
  return `${KEY_PREFIX}:${address.toLowerCase()}`;
}

export function emptyHistoryState(): StoredWalletHistory {
  return {
    v2StreamStates: {
      "token-transfers": { complete: false, cursor: null },
      "internal-transactions": { complete: false, cursor: null },
      transactions: { complete: false, cursor: null },
    },
    historyComplete: false,
    userOpsFetched: false,
    v1SupplementFetched: false,
    activityDays: [],
    txHashes: [],
    dayTxKeys: [],
    tpd: {},
    tokenAssets: [],
    erc20LegCount: 0,
    updatedAt: 0,
    userOpChunkCursor: 0,
    userOpsComplete: false,
    alchemyOutComplete: false,
    alchemyInComplete: false,
    alchemyOutPageKey: null,
    alchemyInPageKey: null,
  };
}

export async function loadWalletHistory(
  address: string
): Promise<StoredWalletHistory | null> {
  return cacheGet<StoredWalletHistory>(keyFor(address));
}

export async function loadOrEmptyHistory(
  address: string
): Promise<StoredWalletHistory> {
  const k = address.toLowerCase();
  const [loaded, fileLoaded, mem] = await Promise.all([
    loadWalletHistory(address),
    loadFileHistory(address),
    Promise.resolve(memHistory.get(k)),
  ]);

  const richest = pickRichestHistory(loaded, fileLoaded, mem);
  if (richest) {
    const merged = {
      ...emptyHistoryState(),
      ...richest,
      dayTxKeys: richest.dayTxKeys ?? [],
      alchemyOutComplete: richest.alchemyOutComplete ?? false,
      alchemyInComplete: richest.alchemyInComplete ?? false,
      alchemyOutPageKey: richest.alchemyOutPageKey ?? null,
      alchemyInPageKey: richest.alchemyInPageKey ?? null,
    };
    // Never treat day-count soft-complete as finished if Alchemy never exhausted.
    if (
      merged.historyComplete &&
      !merged.alchemyOutComplete &&
      !merged.alchemyInComplete &&
      (merged.alchemyOutPageKey ||
        merged.alchemyInPageKey ||
        Object.keys(merged.tpd).length < 90)
    ) {
      merged.historyComplete = false;
    }
    memHistory.set(k, merged);
    return merged;
  }
  return emptyHistoryState();
}

export async function saveWalletHistory(
  address: string,
  state: StoredWalletHistory
): Promise<void> {
  const k = address.toLowerCase();
  const existing = memHistory.get(k);
  const mergedTpd = { ...(existing?.tpd ?? {}) };
  for (const [day, count] of Object.entries(state.tpd)) {
    mergedTpd[day] = Math.max(mergedTpd[day] ?? 0, count);
  }
  const next: StoredWalletHistory = {
    ...emptyHistoryState(),
    ...(existing ?? {}),
    ...state,
    updatedAt: Date.now(),
    tpd: mergedTpd,
    activityDays: Object.entries(mergedTpd)
      .filter(([, c]) => c > 0)
      .map(([d]) => d)
      .sort(),
    txHashes: [
      ...new Set([...(existing?.txHashes ?? []), ...(state.txHashes ?? [])]),
    ],
    dayTxKeys: [
      ...new Set([
        ...(existing?.dayTxKeys ?? []),
        ...(state.dayTxKeys ?? []),
      ]),
    ],
  };
  memHistory.set(k, next);
  void saveFileHistory(address, next);
  const ttl = state.historyComplete ? TTL_COMPLETE_SECONDS : TTL_SECONDS;
  await cacheSet(keyFor(address), next, ttl).catch(() => {});
}

function dayTxKey(hash: string, day: string): string {
  return `${hash.toLowerCase()}|${day}`;
}

/** Active days that match heatmap cells (days with tx count > 0). */
export function uniqueDaysFromState(state: StoredWalletHistory): number {
  return Object.entries(state.tpd).filter(([, c]) => c > 0).length;
}

export type ActivityIndex = Pick<
  StoredWalletHistory,
  | "activityDays"
  | "txHashes"
  | "dayTxKeys"
  | "tpd"
  | "tokenAssets"
  | "erc20LegCount"
>;

/** Build heatmap index from transfers — one count per unique tx hash per day. */
export function buildActivityIndex(
  transfers: AlchemyTransfer[],
  wallet: string
): ActivityIndex {
  const w = wallet.toLowerCase();
  const dayTxKeys = new Set<string>();
  const days = new Set<string>();
  const hashes = new Set<string>();
  const tpd: Record<string, number> = {};
  const tokenAssets = new Set<string>();
  let erc20LegCount = 0;

  for (const tx of transfers) {
    if (!countsTowardActivity(tx, w) || !tx.metadata?.blockTimestamp) continue;

    const dk = getDayKey(tx.metadata.blockTimestamp);
    const key = dayTxKey(tx.hash, dk);
    hashes.add(tx.hash.toLowerCase());

    if (!dayTxKeys.has(key)) {
      dayTxKeys.add(key);
      days.add(dk);
      tpd[dk] = (tpd[dk] || 0) + 1;
    }

    if (tx.category === "erc20") {
      erc20LegCount++;
      if (tx.asset) tokenAssets.add(tx.asset);
    }
    if (tx.category === "erc721" || tx.category === "erc1155") {
      if (tx.asset) tokenAssets.add(tx.asset);
    }
  }

  return {
    activityDays: Array.from(days).sort(),
    txHashes: Array.from(hashes),
    dayTxKeys: Array.from(dayTxKeys),
    tpd,
    tokenAssets: Array.from(tokenAssets),
    erc20LegCount,
  };
}

/** Merge new transfer legs without double-counting the same tx on the same day. */
export function mergeActivityIntoState(
  state: StoredWalletHistory,
  transfers: AlchemyTransfer[],
  wallet: string
): StoredWalletHistory {
  if (!transfers.length) return state;

  const w = wallet.toLowerCase();
  const dayTxKeys = new Set(state.dayTxKeys ?? []);
  const days = new Set(state.activityDays);
  const hashes = new Set(state.txHashes);
  const tpd = { ...state.tpd };
  const tokenAssets = new Set(state.tokenAssets);
  let erc20LegCount = state.erc20LegCount;

  for (const tx of transfers) {
    if (!countsTowardActivity(tx, w) || !tx.metadata?.blockTimestamp) continue;

    const dk = getDayKey(tx.metadata.blockTimestamp);
    const key = dayTxKey(tx.hash, dk);
    hashes.add(tx.hash.toLowerCase());

    if (!dayTxKeys.has(key)) {
      dayTxKeys.add(key);
      days.add(dk);
      tpd[dk] = (tpd[dk] || 0) + 1;
    }

    if (tx.category === "erc20") {
      erc20LegCount++;
      if (tx.asset) tokenAssets.add(tx.asset);
    }
    if (tx.category === "erc721" || tx.category === "erc1155") {
      if (tx.asset) tokenAssets.add(tx.asset);
    }
  }

  return {
    ...state,
    activityDays: Array.from(days).sort(),
    txHashes: Array.from(hashes),
    dayTxKeys: Array.from(dayTxKeys),
    tpd,
    tokenAssets: Array.from(tokenAssets),
    erc20LegCount,
  };
}

export function activityCounts(state: StoredWalletHistory): {
  uniqueDays: number;
  txCount: number;
} {
  return {
    uniqueDays: uniqueDaysFromState(state),
    txCount: state.txHashes.length,
  };
}

/** Validate rollup matches compact index (dev / tests). */
export function activityIndexMatchesRollup(
  transfers: AlchemyTransfer[],
  wallet: string,
  index: ActivityIndex
): boolean {
  const rollup = rollupWalletActivity(transfers, wallet);
  return (
    rollup.uDays.size === uniqueDaysFromState(index as StoredWalletHistory) &&
    rollup.participatingHashes.size === index.txHashes.length
  );
}
