"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";

export interface TokenHolding {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  address: string | null;
  decimals: number;
  logo: string | null;
  counter: SwapCounter;
}

function holdingToCounter(h: {
  symbol: string;
  address: string | null;
  decimals: number;
  logo: string | null;
}): SwapCounter {
  if (!h.address || h.symbol === "ETH") return { kind: "eth" };
  return {
    kind: "token",
    address: h.address as `0x${string}`,
    symbol: h.symbol,
    decimals: h.decimals,
    imageUrl: h.logo ?? undefined,
  };
}

export function useWalletHoldings(walletAddress: string | null | undefined) {
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDust, setShowDust] = useState(false);

  const fetchHoldings = useCallback(async () => {
    if (!walletAddress) {
      setHoldings([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/wallet-holdings?address=${encodeURIComponent(walletAddress)}`);
      if (!res.ok) throw new Error("Failed to load holdings");
      const data = (await res.json()) as {
        holdings?: Array<{
          symbol: string;
          name: string;
          balance: number;
          usdValue: number;
          address: string | null;
          decimals: number;
          logo: string | null;
        }>;
      };

      const mapped: TokenHolding[] = (data.holdings ?? []).map((h) => ({
        ...h,
        counter: holdingToCounter(h),
      }));

      // Sort descending by USD value, then by balance
      mapped.sort((a, b) => b.usdValue - a.usdValue || b.balance - a.balance);

      setHoldings(mapped);
    } catch {
      // Keep previous holdings if refresh failed
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void fetchHoldings();
  }, [fetchHoldings]);

  const totalUsd = useMemo(() => {
    return holdings.reduce((sum, h) => sum + (Number.isFinite(h.usdValue) ? h.usdValue : 0), 0);
  }, [holdings]);

  const visibleHoldings = useMemo(() => {
    if (showDust) return holdings;
    // Dust is defined as USD value < $0.01
    return holdings.filter((h) => h.usdValue >= 0.01 || h.symbol === "ETH");
  }, [holdings, showDust]);

  const dustCount = useMemo(() => {
    return holdings.filter((h) => h.usdValue < 0.01 && h.symbol !== "ETH").length;
  }, [holdings]);

  return {
    holdings: visibleHoldings,
    allHoldings: holdings,
    totalUsd,
    dustCount,
    showDust,
    setShowDust,
    loading,
    refresh: fetchHoldings,
  };
}
