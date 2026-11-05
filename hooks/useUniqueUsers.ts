"use client";

import { useEffect, useSyncExternalStore } from "react";

interface UniqueUsersState {
  count: number;
  formatted: string;
  loading: boolean;
}

// Module-level store ensuring all components on the same page remain 100% in sync
let globalState: UniqueUsersState = {
  count: 0,
  formatted: "0",
  loading: true,
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function updateGlobalState(count: number, formatted?: string) {
  const validCount = typeof count === "number" && !isNaN(count) ? count : globalState.count;
  const validFormatted = formatted || validCount.toLocaleString();

  if (
    globalState.count !== validCount ||
    globalState.formatted !== validFormatted ||
    globalState.loading
  ) {
    globalState = {
      count: validCount,
      formatted: validFormatted,
      loading: false,
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
          updateGlobalState(data.count, data.formatted);
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
export function useUniqueUsers(_connectedAddress?: string | null) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void fetchUniqueUsersCount();
  }, []);

  return state;
}
