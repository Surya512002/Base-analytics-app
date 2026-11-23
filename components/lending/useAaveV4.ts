"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicClient } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { readAaveV4Overview, readAaveV4Position, type AaveV4Overview, type AaveV4Position } from "@/lib/lending/aave-v4/read";

/**
 * Live Aave V4 market data and the connected wallet's position, refreshed every 30 seconds.
 * Does nothing (and makes no requests) unless `enabled`.
 */
export function useAaveV4(enabled: boolean, user?: string | null) {
  const [overview, setOverview] = useState<AaveV4Overview | null>(null);
  const [position, setPosition] = useState<AaveV4Position | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const client = createBasePublicClient() as unknown as PublicClient;
      const o = await readAaveV4Overview(client);
      setOverview(o);
      setPosition(user && /^0x[0-9a-fA-F]{40}$/.test(user) ? await readAaveV4Position(client, user as `0x${string}`, o) : null);
    } catch {
      /* keep the last good numbers; the drawer still works without them */
    } finally {
      setLoading(false);
    }
  }, [enabled, user]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [enabled, load]);

  return { overview, position, loading, refresh: load };
}
