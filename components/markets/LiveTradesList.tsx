"use client";

import { AnimatePresence, motion } from "motion/react";
import { ExternalLink } from "lucide-react";
import type { LiveTrade } from "@/lib/markets/live-trades";
import { formatCompactUsd } from "@/lib/explore/explore-config";

function ago(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

/**
 * Compact buy / sell rows, newest first. New rows slide in. `labelFor` names the token for a
 * trade (Explore feed mixes pools); leave it out when every trade is the same token (Swap).
 */
export default function LiveTradesList({
  trades,
  labelFor,
  now,
  max = 12,
  emptyText = "No trades yet.",
}: {
  trades: LiveTrade[];
  labelFor?: (t: LiveTrade) => string | null;
  /** Current time (ms) from the parent, so relative times tick without impure renders. */
  now: number;
  max?: number;
  emptyText?: string;
}) {
  if (trades.length === 0) {
    return <p className="py-6 text-center text-xs text-[var(--ink-muted)]">{emptyText}</p>;
  }
  return (
    <ul className="divide-y divide-[var(--border-subtle)]/70">
      <AnimatePresence initial={false}>
        {trades.slice(0, max).map((t) => {
          const buy = t.kind === "buy";
          const label = labelFor?.(t);
          return (
            <motion.li
              key={t.id}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2.5 py-2 text-xs"
            >
              <span
                className={`w-11 shrink-0 rounded-full py-0.5 text-center text-[10px] font-black uppercase ${
                  buy
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
              >
                {buy ? "Buy" : "Sell"}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {label && <b className="mr-1.5 text-[var(--ink)]">{label}</b>}
                <span className="font-mono text-[var(--ink-muted)]">{short(t.wallet)}</span>
              </span>
              <span className={`shrink-0 font-mono font-bold tabular-nums ${buy ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {formatCompactUsd(t.usd)}
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-[10px] text-[var(--ink-dim)]">{ago(t.timestamp, now)}</span>
              <a
                href={`https://basescan.org/tx/${t.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View transaction on Basescan"
                className="shrink-0 text-[var(--ink-dim)] transition hover:text-[var(--brand-text)]"
              >
                <ExternalLink size={12} />
              </a>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
