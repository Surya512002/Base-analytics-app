"use client";

import { useCallback, useEffect, useState } from "react";

export type WatchItem = { address: string; symbol: string; name: string; kind: "stock" | "coin"; iconUrl?: string };

const KEY = "trade_watchlist_v1";

function read(): WatchItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as WatchItem[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((w) => w && /^0x[0-9a-fA-F]{40}$/.test(w.address) && typeof w.symbol === "string").slice(0, 50)
      : [];
  } catch {
    return [];
  }
}

/** Per-browser favourites for the Trade page. */
export function useWatchlist() {
  const [items, setItems] = useState<WatchItem[]>([]);

  useEffect(() => {
    setItems(read());
  }, []);

  const persist = (next: WatchItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage blocked — in-memory only */
    }
  };

  const has = useCallback((address: string) => items.some((w) => w.address.toLowerCase() === address.toLowerCase()), [items]);

  const toggle = useCallback(
    (item: WatchItem) => {
      const exists = items.some((w) => w.address.toLowerCase() === item.address.toLowerCase());
      persist(
        exists
          ? items.filter((w) => w.address.toLowerCase() !== item.address.toLowerCase())
          : [...items, { address: item.address, symbol: item.symbol, name: item.name, kind: item.kind, iconUrl: item.iconUrl }]
      );
    },
    [items]
  );

  return { items, has, toggle };
}
