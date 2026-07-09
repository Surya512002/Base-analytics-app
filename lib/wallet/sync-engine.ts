import {
  decodeV2Cursor,
  fetchBlockscoutV2Chunk,
  V2_STREAMS,
  type V2Stream,
} from "@/lib/api/blockscout-v2";
import {
  collectWalletFastAll,
  collectWalletSupplements,
} from "@/lib/wallet/collect";
import { fetchUserOperationActivityWithProgress } from "@/lib/api/user-operations";
import { mergeTransfers } from "@/lib/utils/wallet-activity";
import type { AlchemyTransfer } from "@/lib/types/wallet";
import type { DayStats } from "@/lib/types/wallet";
import {
  loadOrEmptyHistory,
  mergeActivityIntoState,
  saveWalletHistory,
  uniqueDaysFromState,
  type StoredWalletHistory,
} from "@/lib/wallet/history-store";

const PAGES_PER_STEP = 30;

export interface SyncBurstResult {
  transfers: AlchemyTransfer[];
  state: StoredWalletHistory;
}

function allV2Complete(states: Record<string, { complete: boolean }>): boolean {
  return V2_STREAMS.every((s) => states[s]?.complete);
}

async function advanceAllV2StreamsParallel(
  address: string,
  state: StoredWalletHistory
): Promise<{ state: StoredWalletHistory; legs: AlchemyTransfer[] }> {
  const pending = V2_STREAMS.filter((s) => !state.v2StreamStates[s]?.complete);
  if (!pending.length) return { state, legs: [] };

  const chunks = await Promise.all(
    pending.map(async (stream) => {
      const streamState = state.v2StreamStates[stream];
      const cursor = streamState?.cursor
        ? decodeV2Cursor(streamState.cursor)
        : null;
      const chunk = await fetchBlockscoutV2Chunk(
        address,
        stream,
        cursor,
        PAGES_PER_STEP
      );
      return { stream, chunk };
    })
  );

  let next = { ...state, historyComplete: false };
  const nextStates = { ...next.v2StreamStates };
  let legs: AlchemyTransfer[] = [];

  for (const { stream, chunk } of chunks) {
    nextStates[stream] = {
      complete: chunk.done,
      cursor: chunk.done ? null : chunk.nextCursor,
    };
    legs = mergeTransfers([legs, chunk.transfers]);
    next = mergeActivityIntoState(next, chunk.transfers, address);
  }

  next = { ...next, v2StreamStates: nextStates };
  await saveWalletHistory(address, next);
  return { state: next, legs };
}

async function advanceUserOpScan(
  address: string,
  state: StoredWalletHistory
): Promise<{ state: StoredWalletHistory; legs: AlchemyTransfer[] }> {
  if (state.userOpsComplete) return { state, legs: [] };

  const result = await fetchUserOperationActivityWithProgress(address, {
    timeoutMs: 45_000,
    maxChunks: 30,
    startChunk: state.userOpChunkCursor ?? 0,
  });

  let next = mergeActivityIntoState(state, result.transfers, address);
  next = {
    ...next,
    userOpChunkCursor: result.chunksScanned,
    userOpsComplete: result.complete,
  };
  await saveWalletHistory(address, next);

  return { state: next, legs: result.transfers };
}

/** Heatmap cells from live rollup tpd — keeps active days in sync with the grid (d731448). */
export function buildDailyStatsFromTpd(
  tpd: Map<string, number>,
  histDays: number
): DayStats[] {
  const now = new Date();
  const dStats: DayStats[] = [];
  const hPtr = new Date(now);
  for (let i = 0; i < histDays; i++) {
    const ds = hPtr.toISOString().slice(0, 10);
    const c = tpd.get(ds) || 0;
    let intensity = 0;
    if (c > 0) intensity = 1;
    if (c > 2) intensity = 2;
    if (c > 5) intensity = 3;
    if (c > 10) intensity = 4;
    dStats.unshift({ date: ds, count: c, intensity });
    hPtr.setUTCDate(hPtr.getUTCDate() - 1);
  }
  return dStats;
}

export function buildDailyStatsFromState(
  state: StoredWalletHistory,
  minDays = 364
): DayStats[] {
  const now = new Date();
  let histDays = minDays;

  const datedEntries = Object.entries(state.tpd).filter(([, c]) => c > 0);
  if (datedEntries.length > 0) {
    const oldest = datedEntries
      .map(([d]) => d)
      .reduce((a, b) => (a < b ? a : b));
    const oldestTs = new Date(`${oldest}T12:00:00Z`).getTime();
    const span = Math.ceil((now.getTime() - oldestTs) / 86400000) + 14;
    histDays = Math.max(minDays, span);
  } else if (state.activityDays.length > 0) {
    const oldest = state.activityDays.reduce((a, b) => (a < b ? a : b));
    const oldestTs = new Date(`${oldest}T12:00:00Z`).getTime();
    const span = Math.ceil((now.getTime() - oldestTs) / 86400000) + 14;
    histDays = Math.max(minDays, span);
  }

  const dStats: DayStats[] = [];
  const hPtr = new Date(now);
  for (let i = 0; i < histDays; i++) {
    const ds = hPtr.toISOString().slice(0, 10);
    const c = state.tpd[ds] || 0;
    let intensity = 0;
    if (c > 0) intensity = 1;
    if (c > 2) intensity = 2;
    if (c > 5) intensity = 3;
    if (c > 10) intensity = 4;
    dStats.unshift({ date: ds, count: c, intensity });
    hPtr.setUTCDate(hPtr.getUTCDate() - 1);
  }
  return dStats;
}

function emptyFromBoot(
  v2StreamStates: StoredWalletHistory["v2StreamStates"]
): StoredWalletHistory {
  return {
    v2StreamStates,
    historyComplete: false,
    userOpsFetched: false,
    v1SupplementFetched: false,
    activityDays: [],
    txHashes: [],
    dayTxKeys: [],
    tpd: {},
    tokenAssets: [],
    erc20LegCount: 0,
    userOpChunkCursor: 0,
    userOpsComplete: false,
    updatedAt: 0,
  };
}

/**
 * Continue v2 pagination from saved cursors (token stream first).
 * Only bootstraps from connect fetch when Redis has no activity index yet.
 */
export async function runWalletSyncBurst(
  address: string,
  budgetMs = 58_000
): Promise<SyncBurstResult> {
  const deadline = Date.now() + budgetMs;
  let state = await loadOrEmptyHistory(address);
  let initTransfers: AlchemyTransfer[] = [];
  let newLegs: AlchemyTransfer[] = [];

  if (!state.activityDays.length && !Object.keys(state.tpd).length) {
    const collected = await collectWalletFastAll(address);
    initTransfers = collected.transfers;
    const base = emptyFromBoot(collected.v2StreamStates);
    state = mergeActivityIntoState(base, collected.transfers, address);
    state = { ...state, v2StreamStates: collected.v2StreamStates };
    if (collected.historyComplete) {
      state = { ...state, historyComplete: true };
    }
    await saveWalletHistory(address, state);
    if (state.historyComplete) {
      return { transfers: initTransfers, state };
    }
  }

  if (state.historyComplete) {
    return { transfers: mergeTransfers([initTransfers, newLegs]), state };
  }

  let idleRounds = 0;
  while (Date.now() < deadline) {
    if (!state.userOpsComplete) {
      const uop = await advanceUserOpScan(address, state);
      state = uop.state;
      if (uop.legs.length) {
        newLegs = mergeTransfers([newLegs, uop.legs]);
        idleRounds = 0;
      }
    }

    if (allV2Complete(state.v2StreamStates)) break;

    const daysBefore = uniqueDaysFromState(state);
    const advanced = await advanceAllV2StreamsParallel(address, state);
    state = advanced.state;
    if (advanced.legs.length) {
      newLegs = mergeTransfers([newLegs, advanced.legs]);
      idleRounds = 0;
    } else {
      idleRounds++;
      if (idleRounds >= 2) break;
    }

    if (uniqueDaysFromState(state) > daysBefore) {
      idleRounds = 0;
    }
  }

  if (allV2Complete(state.v2StreamStates) && !state.userOpsFetched) {
    if (!state.userOpsComplete) {
      const uop = await fetchUserOperationActivityWithProgress(address, {
        timeoutMs: 90_000,
        maxChunks: 80,
        startChunk: state.userOpChunkCursor ?? 0,
      });
      state = mergeActivityIntoState(state, uop.transfers, address);
      state = {
        ...state,
        userOpChunkCursor: uop.chunksScanned,
        userOpsComplete: uop.complete,
      };
      newLegs = mergeTransfers([newLegs, uop.transfers]);
    }

    const sup = await collectWalletSupplements(address);
    state = mergeActivityIntoState(state, sup.transfers, address);
    state = {
      ...state,
      userOpsFetched: true,
      v1SupplementFetched: true,
      historyComplete: true,
    };
    await saveWalletHistory(address, state);
    newLegs = mergeTransfers([newLegs, sup.transfers]);
  }

  return {
    transfers: mergeTransfers([initTransfers, newLegs]),
    state,
  };
}
