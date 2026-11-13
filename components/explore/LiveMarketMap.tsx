"use client";

import React, { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Activity, CircleDot, List, Radio } from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import { formatCompactUsd } from "@/lib/explore/explore-config";
import TokenAvatar from "@/components/ui/TokenAvatar";
import ActivePill from "@/components/ui/motion/ActivePill";
import LiveTradesList from "@/components/markets/LiveTradesList";
import { useLiveTrades, useNow } from "@/hooks/useLiveTrades";

type Sort = "volume" | "bought" | "sold";
type View = "bubbles" | "list";

const SORTS: Array<{ id: Sort; label: string }> = [
  { id: "volume", label: "Volume" },
  { id: "bought", label: "More bought" },
  { id: "sold", label: "More sold" },
];

/** Share of 24h transactions that were buys (0..1), or null when the source has no split. */
export function buyShare(t: UnifiedToken): number | null {
  const b = t.buys24h ?? 0;
  const s = t.sells24h ?? 0;
  return b + s > 0 ? b / (b + s) : null;
}

/**
 * "Live market": every active token as a bubble sized by 24h volume and tinted by its 24h
 * move (or as a list), next to a feed of the latest buys and sells in the busiest pools.
 */
export default function LiveMarketMap({
  tokens,
  onOpenToken,
}: {
  tokens: UnifiedToken[];
  onOpenToken: (token: UnifiedToken) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<View>("bubbles");
  const [sort, setSort] = useState<Sort>("volume");
  const now = useNow();

  const active = useMemo(
    () => tokens.filter((t) => t.hasPool && t.volume24h > 0).sort((a, b) => b.volume24h - a.volume24h).slice(0, 24),
    [tokens]
  );

  const sorted = useMemo(() => {
    if (sort === "volume") return active;
    const dir = sort === "bought" ? -1 : 1;
    return [...active].sort((a, b) => dir * ((buyShare(a) ?? 0.5) - (buyShare(b) ?? 0.5)));
  }, [active, sort]);

  // Feed: the five busiest pools.
  const feedPools = useMemo(
    () => active.map((t) => t.pairAddress?.toLowerCase()).filter((p): p is string => Boolean(p)).slice(0, 5),
    [active]
  );
  const poolLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of active) if (t.pairAddress) m.set(t.pairAddress.toLowerCase(), t.symbol);
    return m;
  }, [active]);
  const { trades, loading: tradesLoading } = useLiveTrades({ pools: feedPools });

  const maxVol = active[0]?.volume24h ?? 1;
  if (active.length === 0) return null;

  return (
    <section className="space-y-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-xs sm:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-[var(--ink)] sm:text-xl">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Live market
          </h2>
          <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
            Bubble size is 24h volume; colour is the 24h move. Tap one to open it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Sort" className="flex gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={sort === s.id}
                onClick={() => setSort(s.id)}
                className={`relative isolate cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  sort === s.id ? "text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {sort === s.id && <ActivePill layoutId="live-market-sort" className="bg-[var(--brand)]" />}
                {s.label}
              </button>
            ))}
          </div>
          <div role="tablist" aria-label="View" className="flex gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1">
            {(
              [
                ["bubbles", CircleDot, "Bubbles"],
                ["list", List, "List"],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                aria-label={label}
                title={label}
                onClick={() => setView(id)}
                className={`relative isolate flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  view === id ? "text-[var(--ink)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {view === id && <ActivePill layoutId="live-market-view" className="tab-active" />}
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Map / list */}
        <div className="@container min-h-[260px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/50 p-3 sm:p-4">
          {view === "bubbles" ? (
            <div className="flex flex-wrap content-center items-center justify-center gap-2 sm:gap-3">
              {sorted.map((t, i) => {
                const size = Math.round(52 + 98 * Math.sqrt(t.volume24h / maxVol)); // 52–150px
                const up = t.priceChange24h >= 0;
                const strength = Math.min(1, Math.abs(t.priceChange24h) / 15);
                const share = buyShare(t);
                return (
                  <motion.button
                    key={t.id}
                    type="button"
                    layout
                    onClick={() => onOpenToken(t)}
                    title={`${t.symbol}: ${formatCompactUsd(t.volume24h)} 24h volume`}
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: [0, -4, 0] }}
                    transition={
                      reduceMotion
                        ? { duration: 0.2 }
                        : {
                            opacity: { duration: 0.3, delay: i * 0.02 },
                            scale: { type: "spring", stiffness: 260, damping: 20, delay: i * 0.02 },
                            y: { duration: 4 + (i % 5), repeat: Infinity, ease: "easeInOut" },
                            layout: { type: "spring", stiffness: 300, damping: 30 },
                          }
                    }
                    whileHover={reduceMotion ? undefined : { scale: 1.06 }}
                    style={{
                      // Scale with the map box (container query units), never below 44px.
                      width: `clamp(44px, ${size / 6}cqw, ${size}px)`,
                      height: `clamp(44px, ${size / 6}cqw, ${size}px)`,
                      background: up
                        ? `rgba(16,185,129,${0.1 + strength * 0.3})`
                        : `rgba(239,68,68,${0.1 + strength * 0.3})`,
                      borderColor: up ? "rgba(16,185,129,0.45)" : "rgba(239,68,68,0.45)",
                    }}
                    className="flex shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full border text-center"
                  >
                    {size >= 80 && (
                      <TokenAvatar
                        src={t.imageUrl}
                        address={t.address}
                        symbol={t.symbol}
                        className="h-6 w-6 rounded-full"
                        textClassName="text-[8px]"
                      />
                    )}
                    <span className="max-w-[90%] truncate text-[11px] font-black text-[var(--ink)] sm:text-xs">{t.symbol}</span>
                    <span
                      className={`font-mono text-[10px] font-bold ${
                        up ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      {up ? "+" : ""}
                      {t.priceChange24h.toFixed(1)}%
                    </span>
                    {size >= 110 && share != null && (
                      <span className="text-[9px] font-semibold text-[var(--ink-muted)]">{Math.round(share * 100)}% buys</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]/70">
              {sorted.map((t) => {
                const share = buyShare(t);
                const up = t.priceChange24h >= 0;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onOpenToken(t)}
                      className="flex w-full cursor-pointer items-center gap-3 py-2 text-left text-sm transition hover:bg-[var(--surface)]"
                    >
                      <TokenAvatar src={t.imageUrl} address={t.address} symbol={t.symbol} className="h-7 w-7 rounded-full" textClassName="text-[9px]" />
                      <span className="w-20 truncate font-bold text-[var(--ink)]">{t.symbol}</span>
                      <span className="hidden flex-1 sm:block">
                        <BuySellBar buys={t.buys24h} sells={t.sells24h} />
                      </span>
                      <span className="ml-auto font-mono text-xs tabular-nums text-[var(--ink-muted)]">{formatCompactUsd(t.volume24h)}</span>
                      <span className={`w-14 text-right font-mono text-xs font-bold ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {up ? "+" : ""}
                        {t.priceChange24h.toFixed(1)}%
                      </span>
                      <span className="hidden w-16 text-right text-[11px] text-[var(--ink-muted)] md:block">
                        {share == null ? "—" : `${Math.round(share * 100)}% buys`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Latest trades */}
        <aside className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 sm:p-4">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-black text-[var(--ink)]">
              <Activity size={15} className="text-[var(--brand-text)]" /> Latest trades
            </h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[var(--ink-muted)]">
              <Radio size={11} className="text-emerald-500" /> live
            </span>
          </div>
          <div className="max-h-[360px] overflow-y-auto no-scrollbar">
            <LiveTradesList
              trades={trades}
              now={now}
              labelFor={(t) => poolLabel.get(t.pool) ?? null}
              emptyText={tradesLoading ? "Loading the latest trades…" : "Live trades are catching up — check back in a minute."}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}

/** Green/red split of 24h buys vs sells. Renders nothing when the source has no split. */
export function BuySellBar({ buys, sells, showCounts = false }: { buys?: number; sells?: number; showCounts?: boolean }) {
  const b = buys ?? 0;
  const s = sells ?? 0;
  if (b + s === 0) return <span className="text-[11px] text-[var(--ink-dim)]">—</span>;
  const pct = (b / (b + s)) * 100;
  return (
    <span className="block" title={`${b.toLocaleString()} buys · ${s.toLocaleString()} sells (24h)`}>
      {showCounts && (
        <span className="mb-0.5 flex justify-between font-mono text-[10px]">
          <span className="text-emerald-600 dark:text-emerald-400">{b.toLocaleString()}</span>
          <span className="text-red-600 dark:text-red-400">{s.toLocaleString()}</span>
        </span>
      )}
      <span className="flex h-1.5 overflow-hidden rounded-full bg-red-500/70">
        <span className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}
