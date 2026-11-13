"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Lock, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import type { LaunchBoardRow, LaunchBoardStats } from "@/lib/launchpad/launch-board";
import { formatCompactUsd } from "@/lib/explore/explore-config";
import TokenAvatar from "@/components/ui/TokenAvatar";
import ActivePill from "@/components/ui/motion/ActivePill";
import NumberTicker from "@/components/ui/motion/NumberTicker";
import { BuySellBar } from "@/components/explore/LiveMarketMap";
import { useNow } from "@/hooks/useLiveTrades";

type Board = { stats: LaunchBoardStats; trending: LaunchBoardRow[]; justLaunched: LaunchBoardRow[] };

function age(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

/** Fetches the launch board every 30s while visible. */
function useLaunchBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/launchpad/board");
        if (res.ok && !cancelled) setBoard((await res.json()) as Board);
      } catch {
        /* keep last */
      }
    };
    void load();
    const t = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);
  return board;
}

/** Launch stats strip, openlaunch style: what launches here have done today. */
export function LaunchStatsStrip() {
  const board = useLaunchBoard();
  const s = board?.stats;
  const items: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Tokens launched", value: s ? <NumberTicker value={s.launched} /> : "—" },
    { label: "Launched today", value: s ? <NumberTicker value={s.launchedToday} /> : "—" },
    { label: "24h volume", value: s ? formatCompactUsd(s.volume24h) : "—" },
    { label: "24h trades", value: s ? <NumberTicker value={s.trades24h} /> : "—" },
    { label: "Platform launch fee", value: "$0" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5 text-center shadow-xs">
          <div className="font-mono text-lg font-black tabular-nums text-[var(--ink)]">{it.value}</div>
          <div className="text-[11px] font-semibold text-[var(--ink-muted)]">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

/** "Trending today" / "Just launched" board for tokens launched through the app. */
export default function LaunchBoard() {
  const router = useRouter();
  const onOpenToken = (address: string) => router.push(`/explore/token/${address}`);
  const board = useLaunchBoard();
  const [tab, setTab] = useState<"trending" | "new">("trending");
  const now = useNow(30_000);
  const rows = (tab === "trending" ? board?.trending : board?.justLaunched) ?? [];

  return (
    <section className="space-y-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-xs sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-[var(--ink)] sm:text-xl">Launched here</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            {tab === "trending"
              ? "Ranked by trades and volume today, with a boost for launches under 6 hours old."
              : "The newest tokens launched through Base Analytics."}
          </p>
        </div>
        <div role="tablist" aria-label="Launch board" className="flex gap-1 self-start rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1">
          {(
            [
              ["trending", Flame, "Trending today"],
              ["new", Sparkles, "Just launched"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`relative isolate flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                tab === id ? "text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {tab === id && <ActivePill layoutId="launch-board-tab" className="bg-[var(--brand)]" />}
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {!board ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--border-strong)] p-6 text-center">
          <Rocket size={22} className="text-[var(--brand-text)]" />
          <p className="text-sm font-bold text-[var(--ink)]">
            {tab === "trending" ? "Nothing is trading yet today." : "No launches yet."}
          </p>
          <p className="text-xs text-[var(--ink-muted)]">Launch one above — it shows up here straight away.</p>
        </div>
      ) : (
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Token</th>
                <th className="py-2 pr-2 text-right">Market cap</th>
                <th className="py-2 pr-2 text-right">24h</th>
                <th className="py-2 pr-2 text-right">Volume</th>
                <th className="w-28 py-2 pr-2">Buys / Sells</th>
                <th className="py-2 pr-2">Launch</th>
                <th className="py-2 text-right">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]/70">
              {rows.map((r, i) => {
                const ch = r.priceChange24h;
                return (
                  <tr
                    key={r.address}
                    onClick={() => onOpenToken(r.address)}
                    className="cursor-pointer transition hover:bg-[var(--surface-2)]"
                  >
                    <td className="py-2.5 pr-2 font-mono text-[var(--ink-dim)]">{i + 1}</td>
                    <td className="py-2.5 pr-2">
                      <span className="flex items-center gap-2">
                        <TokenAvatar src={r.imageUrl} address={r.address} symbol={r.symbol} className="h-7 w-7 rounded-full" textClassName="text-[9px]" />
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-[var(--ink)]">{r.symbol}</span>
                          <span className="block max-w-[140px] truncate text-[11px] text-[var(--ink-muted)]">{r.name}</span>
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-right font-mono tabular-nums text-[var(--ink)]">
                      {r.marketCap ? formatCompactUsd(r.marketCap) : "—"}
                    </td>
                    <td
                      className={`py-2.5 pr-2 text-right font-mono font-bold ${
                        ch == null ? "text-[var(--ink-dim)]" : ch >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {ch == null ? "—" : `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%`}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-mono tabular-nums text-[var(--ink)]">{formatCompactUsd(r.volume24h)}</td>
                    <td className="py-2.5 pr-2">
                      <BuySellBar buys={r.buys24h} sells={r.sells24h} showCounts />
                    </td>
                    <td className="py-2.5 pr-2">
                      <span className="flex flex-wrap gap-1">
                        {r.liquidityLocked && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400" title="Liquidity locked">
                            <Lock size={10} /> LP locked
                          </span>
                        )}
                        {r.antiSnipeBlocks ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-text)]" title={`Buys blocked for the first ${r.antiSnipeBlocks} blocks`}>
                            <ShieldCheck size={10} /> Anti-snipe
                          </span>
                        ) : null}
                        {r.quoteAsset && (
                          <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ink-muted)]">/{r.quoteAsset}</span>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-[var(--ink-muted)]">{now ? age(now - r.createdAt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
