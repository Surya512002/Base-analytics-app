"use client";

import { useEffect, useSyncExternalStore } from "react";

export interface DailyUsers {
  day: string;
  users: number;
}

interface UniqueUsersState {
  count: number;
  formatted: string;
  loading: boolean;
  /** Unique wallets active today (UTC). */
  today: number;
  /** Wallets seen for the first time today. */
  newToday: number;
  /** Last 7 days, oldest first. */
  last7: DailyUsers[];
}

type Activity = { today?: number; newToday?: number; last7?: DailyUsers[] };

// Module-level store ensuring all components on the same page remain 100% in sync
let globalState: UniqueUsersState = {
  count: 0,
  formatted: "0",
  loading: true,
  today: 0,
  newToday: 0,
  last7: [],
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function updateGlobalState(count: number, formatted?: string, activity?: Activity) {
  const validCount = typeof count === "number" && !isNaN(count) ? count : globalState.count;
  const validFormatted = formatted || validCount.toLocaleString();
  const today = typeof activity?.today === "number" ? activity.today : globalState.today;
  const newToday = typeof activity?.newToday === "number" ? activity.newToday : globalState.newToday;
  const last7 = Array.isArray(activity?.last7) ? activity.last7 : globalState.last7;

  if (
    globalState.count !== validCount ||
    globalState.formatted !== validFormatted ||
    globalState.loading ||
    globalState.today !== today ||
    globalState.newToday !== newToday ||
    JSON.stringify(globalState.last7) !== JSON.stringify(last7)
  ) {
    globalState = {
      count: validCount,
      formatted: validFormatted,
      loading: false,
      today,
      newToday,
      last7,
    };
    emitChange();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): UniqueUsersState {
  return globalState;
}

const serverSnapshot: UniqueUsersState = {
  count: 0,
  formatted: "0",
  loading: false,
  today: 0,
  newToday: 0,
  last7: [],
};

function getServerSnapshot(): UniqueUsersState {
  return serverSnapshot;
}

let activeFetch: Promise<void> | null = null;

async function fetchUniqueUsersCount(): Promise<void> {
  if (activeFetch) return activeFetch;

  activeFetch = (async () => {
    try {
      const res = await fetch("/api/app/unique-users", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && typeof data.count === "number") {
          updateGlobalState(data.count, data.formatted, {
            today: data.today,
            newToday: data.newToday,
            last7: data.last7,
          });
        }
      }
    } catch (err) {
      console.warn("[useUniqueUsers] GET failed:", err);
    } finally {
      activeFetch = null;
    }
  })();

  return activeFetch;
}

/**
 * Report a confirmed on-chain in-app transaction to record the user as verified.
 * Requires both the wallet address and mined Base transaction hash.
 */
export async function reportConfirmedTransaction(
  address: string,
  txHash: string
): Promise<boolean> {
  const cleanAddr = address?.trim().toLowerCase();
  const cleanTx = txHash?.trim().toLowerCase();

  if (!cleanAddr || !cleanTx) return false;

  try {
    const res = await fetch("/api/app/unique-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: cleanAddr, txHash: cleanTx }),
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (data.ok && typeof data.count === "number") {
        updateGlobalState(data.count, data.formatted);
        return true;
      }
    }
  } catch (err) {
    console.warn("[useUniqueUsers] Transaction report failed:", err);
  }

  return false;
}

/**
 * Hook to retrieve synchronized count of verified active app users.
 * All calling components share the same global state, guaranteeing consistency.
 */
export function useUniqueUsers(connectedAddress?: string | null) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void fetchUniqueUsersCount();
    const t = window.setInterval(() => {
      if (!document.hidden) void fetchUniqueUsersCount();
    }, 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const clean = connectedAddress?.trim().toLowerCase();
    if (!clean || !clean.startsWith("0x") || clean.length !== 42) return;

    void fetch("/api/app/unique-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: clean, action: "connect" }),
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && typeof data.count === "number") {
          updateGlobalState(data.count, data.formatted);
        }
        // pick up today's numbers including this wallet
        void fetchUniqueUsersCount();
      })
      .catch(() => {});
  }, [connectedAddress]);

  return state;
}
