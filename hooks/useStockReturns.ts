"use client";

import { useEffect, useState } from "react";
import { BASE_OFFICIAL_STOCKS } from "@/lib/stocks/base-verified";
import type { StockReturns } from "@/lib/stocks/performance";

// One lookup per distinct list for the whole visit, so re-renders and several screens never repeat it.
const lookups = new Map<string, Promise<Record<string, StockReturns | null> | null>>();

/** 7/30/90-day returns by official stock symbol; a symbol is missing (or null) until data covers the period. */
export function useStockReturns(symbols: string[]): Record<string, StockReturns | null> {
  const [data, setData] = useState<Record<string, StockReturns | null>>({});
  const key = [...new Set(symbols)].sort().join(",");

  useEffect(() => {
    const bySymbol = new Map(BASE_OFFICIAL_STOCKS.map((s) => [s.symbol, s.address.toLowerCase()]));
    const wanted = key ? key.split(",").filter((s) => bySymbol.has(s)).slice(0, 25) : [];
    if (wanted.length === 0) return;
    let alive = true;
    const url = `/api/stocks/returns?addresses=${wanted.map((s) => bySymbol.get(s)).join(",")}`;
    let p = lookups.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { returns?: Record<string, StockReturns | null> } | null) => {
          if (!j?.returns) return null;
          const out: Record<string, StockReturns | null> = {};
          for (const s of wanted) out[s] = j.returns[bySymbol.get(s)!] ?? null;
          // Keep it only if something came back; an empty answer should be retried next visit.
          if (!Object.values(out).some(Boolean)) lookups.delete(url);
          return out;
        })
        .catch(() => {
          lookups.delete(url); /* no numbers is fine: the screens just don't show a return */
          return null;
        });
      lookups.set(url, p);
    }
    void p.then((out) => {
      if (alive && out) setData(out);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return data;
}

export const signedPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
