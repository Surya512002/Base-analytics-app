"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { MarketsOverview, StockMarketItem } from "@/lib/markets/types";

interface UseMarketsOverviewResult {
  overview: MarketsOverview | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMarketsOverview(): UseMarketsOverviewResult {
  const [overview, setOverview] = useState<MarketsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchOverview = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const url = `/api/markets/overview${isRefresh ? "?refresh=true" : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.ok && json.data) {
        if (mountedRef.current) {
          setOverview(json.data);
          setError(null);
        }
      } else {
        throw new Error(json.error || "Failed to load overview");
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Error fetching markets");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchOverview(false);

    // Auto-refresh every 60 seconds when tab is active
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void fetchOverview(true);
      }
    }, 60_000);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [fetchOverview]);

  return {
    overview,
    loading,
    error,
    refresh: () => fetchOverview(true),
  };
}

interface UseStockMarketsOptions {
  category?: string;
  sortBy?: "liquidity" | "price" | "change" | "impact" | "collateral";
  sortDir?: "asc" | "desc";
  query?: string;
}

interface UseStockMarketsResult {
  stocks: StockMarketItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useStockMarkets(options: UseStockMarketsOptions = {}): UseStockMarketsResult {
  const [stocks, setStocks] = useState<StockMarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const { category, sortBy, sortDir, query } = options;

  const fetchStocks = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const params = new URLSearchParams();
      if (category && category !== "all") params.set("category", category);
      if (sortBy) params.set("sort", sortBy);
      if (sortDir) params.set("dir", sortDir);
      if (query) params.set("query", query);
      if (isRefresh) params.set("refresh", "true");

      const res = await fetch(`/api/markets/stocks?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        if (mountedRef.current) {
          setStocks(json.data);
          setError(null);
        }
      } else {
        throw new Error(json.error || "Failed to load stocks");
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Error fetching stocks");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [category, sortBy, sortDir, query]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchStocks(false);

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void fetchStocks(true);
      }
    }, 60_000);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [fetchStocks]);

  return {
    stocks,
    loading,
    error,
    refresh: () => fetchStocks(true),
  };
}
