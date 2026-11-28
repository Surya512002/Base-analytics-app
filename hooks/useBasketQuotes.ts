"use client";

import { useEffect, useState } from "react";
import { formatUnits, type Address } from "viem";
import { computeTradeSafety } from "@/lib/markets/price-impact-service";
import { fetchBasketQuote } from "@/lib/swap/basket-quote";
import { BASE_OFFICIAL_STOCKS } from "@/lib/stocks/base-verified";
import { USDC_BASE } from "@/lib/launchpad/tokens-base";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { ERC20_ABI } from "@/lib/constants/contracts";
import type { SwapQuoteResponse } from "@/lib/api/launchpad-client";

export const STOCK_DECIMALS = 8;
const REFRESH_MS = 30_000;
const STOCKS = new Map(BASE_OFFICIAL_STOCKS.map((s) => [s.symbol, s]));

/** Live buy prices for several stocks at once, refreshed every 30 seconds. `refresh` forces a new read. */
export function useBasketQuotes(items: Array<{ symbol: string; amount: string }>, slippagePct: number, refresh = 0) {
  const [quotes, setQuotes] = useState<{ key: string; bySymbol: Record<string, SwapQuoteResponse> }>({ key: "", bySymbol: {} });
  const key = `${items.map((l) => `${l.symbol}:${l.amount}`).join(",")}|${slippagePct}`;

  useEffect(() => {
    if (items.length === 0) return;
    let alive = true;
    const load = async () => {
      const results = await Promise.all(
        items.map(async (l) => {
          const s = STOCKS.get(l.symbol)!;
          return [l.symbol, await fetchBasketQuote({ token: s.address, decimals: STOCK_DECIMALS, usdc: l.amount, slippageBps: slippagePct * 100 })] as const;
        })
      );
      if (alive) setQuotes({ key, bySymbol: Object.fromEntries(results) });
    };
    const first = setTimeout(() => void load(), 500);
    const again = setInterval(() => void load(), REFRESH_MS);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(again);
    };
    // `key` covers the stocks, amounts and slippage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refresh]);

  const fresh = quotes.key === key;
  const rows = items.map((l) => {
    const q = fresh ? quotes.bySymbol[l.symbol] : undefined;
    const impact = q?.hasLiquidity && q.priceImpactBps != null ? computeTradeSafety(q.priceImpactBps / 100) : null;
    return { ...l, q, impact };
  });
  return {
    key,
    rows,
    quoting: items.length > 0 && !fresh,
    /** The price was read and there is nowhere to buy it. */
    noRoute: rows.filter((r) => r.q && !r.q.hasLiquidity && !r.q.failed),
    /** The price could not be read at all; says nothing about the stock. */
    failed: rows.filter((r) => r.q?.failed),
    critical: rows.filter((r) => r.impact?.tier === "critical"),
    risky: rows.filter((r) => r.impact?.tier === "high"),
  };
}

/** The wallet's USDC, or null while unknown. `refresh` forces a new read. */
export function useUsdcBalance(wallet: string | null, refresh = 0): number | null {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!wallet) return setBalance(null);
    let alive = true;
    createBasePublicClient()
      .readContract({ address: USDC_BASE as Address, abi: ERC20_ABI, functionName: "balanceOf", args: [wallet as Address] })
      .then((v) => alive && setBalance(Number(formatUnits(v as bigint, 6))))
      .catch(() => alive && setBalance(null));
    return () => {
      alive = false;
    };
  }, [wallet, refresh]);
  return balance;
}
