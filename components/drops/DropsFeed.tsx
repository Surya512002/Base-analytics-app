"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CalendarClock, Clock, Flame, Globe, Loader2, RefreshCcw, Search, Shuffle, Users } from "lucide-react";
import { fromUnits } from "@/lib/drops/client";
import { dropsApi, tokenMeta, type FeedItemView, type ListingCategory } from "./drops-api";
import { TASK_META, TaskIcon } from "./task-meta";
import { Notice, Pill, btnPrimary, btnSecondary, inputCls, untilText, useNow } from "./ui";

const CATS: Array<{ id: ListingCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "quest", label: "Quests" },
  { id: "daily", label: "Daily" },
  { id: "holders", label: "Holders" },
  { id: "airdrop", label: "Airdrops" },
  { id: "gift", label: "Gifts" },
];

const STATE_PILL: Record<FeedItemView["state"], { label: string; tone: "ok" | "warn" | "bad" | "muted" | "brand" }> = {
  live: { label: "Live", tone: "ok" },
  soon: { label: "Opens soon", tone: "brand" },
  paused: { label: "Paused", tone: "warn" },
  empty: { label: "All claimed", tone: "muted" },
  ended: { label: "Ended", tone: "muted" },
  closed: { label: "Closed", tone: "bad" },
};

/** Explore: public drops people can find and join, newest first. */
export default function DropsFeed({ onCreate, canCreate }: { onCreate: () => void; canCreate: boolean }) {
  const reduce = useReducedMotion();
  const now = useNow();
  const [items, setItems] = useState<FeedItemView[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [cat, setCat] = useState<ListingCategory | "all">("all");
  const [liveOnly, setLiveOnly] = useState(true);
  const [q, setQ] = useState("");
  const [meta, setMeta] = useState<Record<string, { symbol: string; decimals: number }>>({});

  const resolveTokens = useCallback(async (list: FeedItemView[]) => {
    const addrs = [...new Set(list.map((i) => i.token.toLowerCase()))];
    const found: Record<string, { symbol: string; decimals: number }> = {};
    await Promise.all(
      addrs.map(async (a) => {
        try {
          found[a] = await tokenMeta(a as `0x${string}`);
        } catch {
          found[a] = { symbol: "TOKEN", decimals: 18 };
        }
      })
    );
    setMeta((m) => ({ ...m, ...found }));
  }, []);

  const load = useCallback(async () => {
    setError("");
    setItems(null);
    try {
      const r = await dropsApi.feed();
      setItems(r.items);
      setNext(r.next);
      void resolveTokens(r.items);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Couldn't load drops.");
    }
  }, [resolveTokens]);

  useEffect(() => {
    void load();
  }, [load]);

  const more = async () => {
    if (!next) return;
    setLoadingMore(true);
    try {
      const r = await dropsApi.feed(next);
      setItems((cur) => [...(cur ?? []), ...r.items]);
      setNext(r.next);
      void resolveTokens(r.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load more.");
    } finally {
      setLoadingMore(false);
    }
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((i) => {
      if (cat !== "all" && i.listing.category !== cat) return false;
      if (liveOnly && i.state !== "live" && i.state !== "soon") return false;
      if (needle && !`${i.listing.title} ${i.listing.blurb}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, cat, liveOnly, q]);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-[var(--ink)]">
              <Globe size={18} className="text-[var(--brand-text)]" /> Explore drops
            </h2>
            <p className="text-xs text-[var(--ink-muted)]">Public quests, daily drops and airdrops from creators. Finish the tasks and claim.</p>
          </div>
          <button type="button" className={btnSecondary} onClick={() => void load()} aria-label="Refresh drops">
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" aria-hidden />
            <input aria-label="Search drops" className={`${inputCls} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drops" />
          </div>
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 text-xs font-bold text-[var(--ink)]">
            <input type="checkbox" className="h-4 w-4" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} /> Live only
          </label>
        </div>
        <div role="tablist" aria-label="Categories" className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {CATS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={cat === c.id}
              onClick={() => setCat(c.id)}
              className={`min-h-[36px] shrink-0 rounded-full border px-3.5 text-xs font-bold transition ${
                cat === c.id ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {items === null ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-3xl bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border-subtle)] p-8 text-center">
          <p className="text-sm font-black text-[var(--ink)]">{items.length === 0 ? "No public drops yet" : "Nothing matches your filters"}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--ink-muted)]">
            {items.length === 0 ? "Creators can list a quest or holder drop here when they launch it." : "Try another category, or turn off “Live only”."}
          </p>
          {canCreate && items.length === 0 && (
            <button type="button" className={`${btnPrimary} mx-auto mt-3`} onClick={onCreate}>
              Create the first one
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((i, n) => (
            <FeedCard key={i.id} item={i} meta={meta[i.token.toLowerCase()]} now={now} delay={reduce ? 0 : Math.min(n, 8) * 0.04} />
          ))}
        </div>
      )}

      {next && (
        <div className="text-center">
          <button type="button" className={btnSecondary} onClick={() => void more()} disabled={loadingMore}>
            {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null} Load more
          </button>
        </div>
      )}
    </div>
  );
}

function FeedCard({ item, meta, now, delay }: { item: FeedItemView; meta?: { symbol: string; decimals: number }; now: number; delay: number }) {
  const sym = meta?.symbol ?? "";
  const dec = meta?.decimals ?? 18;
  const per = BigInt(item.amountPerClaim);
  const max = BigInt(item.maxAmountPerClaim);
  const reward = !meta
    ? "…"
    : item.split
      ? `${fromUnits(per, dec)}–${fromUnits(max, dec)} ${sym}`
      : max > per
        ? `Up to ${fromUnits(max, dec)} ${sym}`
        : `${fromUnits(per, dec)} ${sym}`;
  const pct = item.maxClaimsTotal ? Math.min(100, Math.round((item.claimedCount / item.maxClaimsTotal) * 100)) : null;
  const left = item.maxClaimsTotal ? Math.max(0, item.maxClaimsTotal - item.claimedCount) : null;
  const st = STATE_PILL[item.state];
  const types = item.taskTypes.filter((t) => TASK_META[t]).slice(0, 4);

  return (
    <motion.a
      href={`/drops/${item.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      className="group flex min-h-[176px] flex-col gap-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand)]/50 hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={st.tone}>{st.label}</Pill>
        <Pill tone="brand">{item.listing.category[0]!.toUpperCase() + item.listing.category.slice(1)}</Pill>
        {item.daily && item.listing.category !== "daily" && (
          <Pill>
            <Flame size={11} /> Daily
          </Pill>
        )}
        {item.split && (
          <Pill>
            <Shuffle size={11} /> Random
          </Pill>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-base font-black text-[var(--ink)] group-hover:text-[var(--brand-text)]">{item.listing.title}</h3>
        {item.listing.blurb && <p className="mt-0.5 line-clamp-2 text-xs text-[var(--ink-muted)]">{item.listing.blurb}</p>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-black text-[var(--ink)]">{reward}</p>
        {types.length > 0 && (
          <span className="flex -space-x-1.5" aria-label={`${item.taskCount} tasks`}>
            {types.map((t) => (
              <span key={t} className="rounded-xl ring-2 ring-[var(--surface)]">
                <TaskIcon type={t} size={12} />
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {pct !== null && (
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-label={`${item.claimedCount} of ${item.maxClaimsTotal} claimed`}>
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--brand)] to-emerald-400" style={{ width: `${pct}%` }} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-[var(--ink-muted)]">
          {left !== null && (
            <span className="inline-flex items-center gap-1">
              <Users size={11} /> {left} left
            </span>
          )}
          {item.taskCount > 0 && <span>{item.taskCount} task{item.taskCount === 1 ? "" : "s"}</span>}
          {item.state === "soon" ? (
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> opens in {untilText(item.unlockAt, now)}
            </span>
          ) : item.expiresAt > now ? (
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={11} /> ends in {untilText(item.expiresAt, now)}
            </span>
          ) : null}
        </div>
      </div>
    </motion.a>
  );
}
