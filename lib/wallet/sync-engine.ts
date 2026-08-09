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

const PAGES_PER_STEP = 8;

export interface SyncBurstResult {
  transfers: AlchemyTransfer[];
  state: StoredWalletHistory;
}

function allV2Complete(states: Record<string, { complete: boolean }>): boolean {
  return V2_STREAMS.every((s) => states[s]?.complete);
}

async function advanceAllV2StreamsSequential(
  address: string,
  state: StoredWalletHistory,
  deadline: number
): Promise<{ state: StoredWalletHistory; legs: AlchemyTransfer[] }> {
  const pending = V2_STREAMS.filter((s) => !state.v2StreamStates[s]?.complete);
  if (!pending.length) return { state, legs: [] };

  let next = { ...state, historyComplete: false };
  const nextStates = { ...next.v2StreamStates };
  let legs: AlchemyTransfer[] = [];

  for (const stream of pending) {
    if (Date.now() >= deadline) break;

    const streamState = nextStates[stream];
    const cursor = streamState?.cursor
      ? decodeV2Cursor(streamState.cursor)
      : null;
    const chunk = await fetchBlockscoutV2Chunk(
      address,
      stream,
      cursor,
      PAGES_PER_STEP
    );
    nextStates[stream] = {
      complete: chunk.done,
      cursor: chunk.done ? null : chunk.nextCursor,
    };
    legs = mergeTransfers([legs, chunk.transfers]);
    next = mergeActivityIntoState(next, chunk.transfers, address);
    next = { ...next, v2StreamStates: nextStates };
  }

  next = { ...next, v2StreamStates: nextStates };
  await saveWalletHistory(address, next);
  return { state: next, legs };
}

async function advanceUserOpScan(
  address: string,
  state: StoredWalletHistory,
  maxTimeoutMs = 45_000
): Promise<{ state: StoredWalletHistory; legs: AlchemyTransfer[] }> {
  if (state.userOpsComplete) return { state, legs: [] };

  const result = await fetchUserOperationActivityWithProgress(address, {
    timeoutMs: maxTimeoutMs,
    maxChunks: 8,
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
    // Prefer a short address-scoped collect — full deep crawl is background only.
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
      const uop = await advanceUserOpScan(
        address,
        state,
        Math.min(10_000, Math.max(2_500, deadline - Date.now() - 1_000))
      );
      state = uop.state;
      if (uop.legs.length) {
        newLegs = mergeTransfers([newLegs, uop.legs]);
        idleRounds = 0;
      }
    }

    if (allV2Complete(state.v2StreamStates)) break;

    const daysBefore = uniqueDaysFromState(state);
    const advanced = await advanceAllV2StreamsSequential(address, state, deadline);
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
    const remaining = () => Math.max(0, deadline - Date.now());

    if (!state.userOpsComplete && remaining() > 5_000) {
      const uop = await fetchUserOperationActivityWithProgress(address, {
        timeoutMs: Math.min(remaining() - 2_000, 12_000),
        maxChunks: 8,
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

    if (remaining() > 4_000) {
      const sup = await collectWalletSupplements(address, {
        deadlineMs: Math.min(remaining() - 2_000, 10_000),
      });
      state = mergeActivityIntoState(state, sup.transfers, address);
      newLegs = mergeTransfers([newLegs, sup.transfers]);
      state = {
        ...state,
        userOpsFetched: true,
        v1SupplementFetched: true,
      };
    }

    if (state.userOpsComplete) {
      state = { ...state, historyComplete: true, userOpsFetched: true };
      await saveWalletHistory(address, state);
    }
  }

  // Soft-complete: address index is dense enough for accurate score/heatmap.
  // Deeper genesis UserOp scans are not worth multi-minute wall time.
  if (!state.historyComplete) {
    const days = uniqueDaysFromState(state);
    const v2Done = allV2Complete(state.v2StreamStates);
    const softDone =
      (v2Done && (state.userOpsComplete || (state.userOpChunkCursor ?? 0) >= 10)) ||
      (days >= 40 && v2Done) ||
      (days >= 20 && idleRounds >= 2 && (state.userOpChunkCursor ?? 0) >= 6);
    if (softDone) {
      state = {
        ...state,
        historyComplete: true,
        userOpsFetched: true,
        userOpsComplete: state.userOpsComplete || (state.userOpChunkCursor ?? 0) >= 10,
      };
      await saveWalletHistory(address, state);
    }
  }

  return {
    transfers: mergeTransfers([initTransfers, newLegs]),
    state,
  };
}
