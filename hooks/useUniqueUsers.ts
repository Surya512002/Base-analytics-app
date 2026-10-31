"use client";

import { useEffect, useSyncExternalStore } from "react";

interface UniqueUsersState {
  count: number;
  formatted: string;
  loading: boolean;
}

// Module-level store ensuring all components on the same page remain 100% in sync
let globalState: UniqueUsersState = {
  count: 1420,
  formatted: "1,420",
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
  count: 1420,
  formatted: "1,420",
  loading: false,
};

function getServerSnapshot(): UniqueUsersState {
  return serverSnapshot;
}

let activeFetch: Promise<void> | null = null;
const pingedAddresses = new Set<string>();

async function syncUniqueUsers(address?: string | null): Promise<void> {
  const cleanAddr = address?.trim().toLowerCase();
  const isValid =
    cleanAddr && cleanAddr.startsWith("0x") && cleanAddr.length === 42;

  // Record connected wallet address if valid and not yet pinged in this session
  if (isValid && !pingedAddresses.has(cleanAddr)) {
    const sessionKey = `base_user_pinged_${cleanAddr}`;
    const alreadyInSession =
      typeof window !== "undefined" && window.sessionStorage?.getItem(sessionKey);

    if (!alreadyInSession) {
      try {
        const res = await fetch("/api/app/unique-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: cleanAddr }),
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok && typeof data.count === "number") {
            pingedAddresses.add(cleanAddr);
            if (typeof window !== "undefined") {
              try {
                window.sessionStorage?.setItem(sessionKey, "1");
              } catch {
                /* ignore sessionStorage write error */
              }
            }
            updateGlobalState(data.count, data.formatted);
            return;
          }
        }
      } catch (err) {
        console.warn("[useUniqueUsers] POST failed:", err);
      }
    } else {
      pingedAddresses.add(cleanAddr);
    }
  }

  // Deduplicate in-flight GET requests across concurrent component mounts
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
 * Hook to retrieve synchronized unique active app users.
 * All calling components share the same global state, guaranteeing consistency.
 */
export function useUniqueUsers(connectedAddress?: string | null) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void syncUniqueUsers(connectedAddress);
  }, [connectedAddress]);

  return state;
}
