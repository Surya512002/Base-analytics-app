"use client";

import { useEffect, useState } from "react";
import type { LiveTrade } from "@/lib/markets/live-trades";

/**
 * Polls /api/markets/trades while the page is visible. Pass `pools` (Explore feed, up to 5)
 * or `token` (Swap). Nothing is fetched when neither is set.
 */
export function useLiveTrades({
  pools,
  token,
  intervalMs = 30_000,
  enabled = true,
}: {
  pools?: string[];
  token?: string | null;
  intervalMs?: number;
  enabled?: boolean;
}) {
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const poolKey = (pools ?? []).slice(0, 5).map((p) => p.toLowerCase()).join(",");
  const tokenKey = token?.toLowerCase() ?? "";
  const query = tokenKey ? `token=${tokenKey}` : poolKey ? `pools=${poolKey}` : "";

  useEffect(() => {
    if (!enabled || !query) {
      setTrades([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/markets/trades?${query}`);
        if (!res.ok) return;
        const json = (await res.json()) as { trades?: LiveTrade[]; updatedAt?: number };
        if (!cancelled) {
          setTrades(Array.isArray(json.trades) ? json.trades : []);
          setUpdatedAt(json.updatedAt ?? Date.now());
        }
      } catch {
        // keep the last good list
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [query, intervalMs, enabled]);

  return { trades, loading, updatedAt };
}

/** Current time, refreshed every `ms` (for "12s ago" labels). Starts at 0 until mounted. */
export function useNow(ms = 5_000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = window.setInterval(tick, ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
