"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import { formatCompactUsd } from "@/lib/explore/explore-config";
import { useLiveTrades } from "@/hooks/useLiveTrades";
import TokenAvatar from "@/components/ui/TokenAvatar";

/**
 * "● LATEST · Buy $230 of AERO" pill (openlaunch-style): cycles through the newest trades in
 * the busiest pools every few seconds. Tapping it opens the transaction on Basescan.
 */
export default function LatestTradeTicker({ tokens }: { tokens: UnifiedToken[] }) {
  const reduce = useReducedMotion();
  const busiest = useMemo(
    () =>
      tokens
        .filter((t) => t.hasPool && t.pairAddress && t.volume24h > 0)
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, 5),
    [tokens]
  );
  const pools = useMemo(() => busiest.map((t) => t.pairAddress!.toLowerCase()), [busiest]);
  const byPool = useMemo(() => new Map(busiest.map((t) => [t.pairAddress!.toLowerCase(), t])), [busiest]);
  const { trades } = useLiveTrades({ pools });
  const latest = trades.slice(0, 6);

  const [i, setI] = useState(0);
  useEffect(() => {
    if (latest.length < 2 || reduce) return;
    const t = window.setInterval(() => setI((n) => n + 1), 3500);
    return () => window.clearInterval(t);
  }, [latest.length, reduce]);

  if (latest.length === 0) return null;
  const trade = latest[i % latest.length];
  const token = byPool.get(trade.pool);
  const buy = trade.kind === "buy";

  return (
    <a
      href={`https://basescan.org/tx/${trade.txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Latest trade on Base, opens Basescan"
      className="flex w-full items-center gap-2.5 overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 py-2 text-sm shadow-xs transition hover:border-[var(--brand)]/40"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-[var(--ink-muted)]">Latest</span>
      <span className="relative h-6 min-w-0 flex-1">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={trade.id}
            initial={reduce ? { opacity: 0 } : { y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: -18, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center gap-2"
          >
            {token && (
              <TokenAvatar src={token.imageUrl} address={token.address} symbol={token.symbol} className="h-5 w-5 rounded-md" textClassName="text-[8px]" />
            )}
            <span className="truncate font-semibold text-[var(--ink)]">
              <span className={buy ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{buy ? "Buy" : "Sell"}</span>{" "}
              {formatCompactUsd(trade.usd)}
              {token ? ` of ${token.symbol}` : ""} on Base
            </span>
          </motion.span>
        </AnimatePresence>
      </span>
      <ArrowUpRight size={15} className="shrink-0 text-[var(--ink-dim)]" />
    </a>
  );
}
