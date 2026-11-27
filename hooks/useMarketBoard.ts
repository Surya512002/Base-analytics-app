"use client";

import { useEffect, useState } from "react";
import type { MarketItem } from "@/lib/markets/board";

const REFRESH_MS = 45_000;
const PARTIAL_RETRY_MS = 8_000;
const PARTIAL_RETRIES = 2;
// Home and Markets show the same list, so moving between them does not start from a blank screen.
let last: MarketItem[] = [];

export function useMarketBoard() {
  const [items, setItems] = useState<MarketItem[]>(last);
  const [loading, setLoading] = useState(last.length === 0);

  useEffect(() => {
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;
    const load = async () => {
      try {
        const r = await fetch("/api/markets/board");
        const d = (await r.json()) as { items?: MarketItem[] };
        if (alive && d.items?.length) {
          last = d.items;
          setItems(d.items);
          // Only stocks so far: the other tokens are still being looked up, so ask again soon.
          clearTimeout(retry);
          if (retries < PARTIAL_RETRIES && d.items.every((i) => i.kind !== "token")) {
            retries += 1;
            retry = setTimeout(() => void load(), PARTIAL_RETRY_MS);
          }
        }
      } catch {
        /* keep what is on screen; the next round tries again */
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
      clearTimeout(retry);
    };
  }, []);

  return { items, loading };
}
