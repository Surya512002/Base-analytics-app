"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Star, TrendingDown, TrendingUp } from "lucide-react";
import type { TradeMarket } from "@/app/api/trade/markets/route";
import { formatPrice } from "./CandleChart";
import type { useWatchlist } from "@/lib/trade/watchlist";

type Tab = "all" | "stocks" | "coins" | "watch";

const TABS: Array<[Tab, string]> = [
  ["all", "All"],
  ["stocks", "Stocks"],
  ["coins", "Coins"],
  ["watch", "★"],
];

/**
 * Left rail of the terminal (wide screens): every market in one list with price and 24h change,
 * a search box and a watchlist tab. Click a row to switch the chart and the order ticket.
 */
export default function MarketRail({
  selected,
  onPick,
  watchlist,
}: {
  selected?: string;
  onPick: (m: TradeMarket) => void;
  watchlist: ReturnType<typeof useWatchlist>;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<TradeMarket[]>([]);
  const [loading, setLoading] = useState(true);

  const kind = tab === "stocks" ? "stocks" : tab === "coins" ? "coins" : "all";
  useEffect(() => {
    const ctrl = new AbortController();
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/trade/markets?kind=${kind}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const d = (await r.json()) as { markets?: TradeMarket[] };
        setRows(d.markets ?? []);
      } catch {
        /* aborted or offline */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, q ? 250 : 0);
    return () => {
      clearTimeout(handle);
      ctrl.abort();
    };
  }, [kind, q]);

  const shown = useMemo(() => {
    if (tab !== "watch") return rows;
    const needle = q.trim().toLowerCase();
    return watchlist.items
      .filter((w) => !needle || w.symbol.toLowerCase().includes(needle) || w.name.toLowerCase().includes(needle))
      .map((w) => rows.find((r) => r.address.toLowerCase() === w.address.toLowerCase()) ?? { ...w, priceUsd: null, change24h: null, volume24hUsd: null });
  }, [tab, rows, watchlist.items, q]);

  return (
    <aside aria-label="Markets" className="flex max-h-[calc(100vh-1.5rem)] flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-card">
      <div className="space-y-2 p-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search markets"
            aria-label="Search markets"
            className="h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] pl-8 pr-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-text)]"
          />
        </div>
        <div className="flex gap-1" role="tablist" aria-label="Market type">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`min-h-[28px] flex-1 rounded-md text-[11px] font-bold ${tab === id ? "bg-[var(--ink)] text-[var(--surface)]" : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto_44px] gap-2 px-1 pt-1 text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">
          <span>Market</span>
          <span className="text-right">Price</span>
          <span className="text-right">24h</span>
        </div>
      </div>
      <div className="min-h-[200px] flex-1 overflow-y-auto px-1.5 pb-2">
        {loading && shown.length === 0 && (
          <div className="flex justify-center py-8 text-[var(--ink-muted)]"><Loader2 className="animate-spin" size={16} /></div>
        )}
        {!loading && shown.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-[var(--ink-muted)]">{tab === "watch" ? "Star a market to keep it here" : "No markets found"}</p>
        )}
        {shown.map((m) => {
          const up = (m.change24h ?? 0) >= 0;
          const on = selected?.toLowerCase() === m.address.toLowerCase();
          return (
            <div key={`${m.kind}-${m.address}`} className={`group flex items-center rounded-lg ${on ? "bg-[var(--brand-soft)]" : "hover:bg-[var(--surface-2)]"}`}>
              <button
                type="button"
                aria-label={watchlist.has(m.address) ? `Remove ${m.symbol} from watchlist` : `Add ${m.symbol} to watchlist`}
                aria-pressed={watchlist.has(m.address)}
                onClick={() => watchlist.toggle(m)}
                className="grid h-8 w-6 shrink-0 place-items-center"
              >
                <Star size={12} className={watchlist.has(m.address) ? "fill-amber-400 text-amber-400" : "text-[var(--ink-dim)] opacity-0 group-hover:opacity-100 focus:opacity-100"} />
              </button>
              <button
                type="button"
                onClick={() => onPick(m)}
                aria-current={on ? "true" : undefined}
                className="grid min-h-[40px] min-w-0 flex-1 grid-cols-[1fr_auto_44px] items-center gap-2 py-1 pr-2 text-left"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.iconUrl ? <img src={m.iconUrl} alt="" className="h-5 w-5 shrink-0 rounded-full" /> : <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[8px] font-bold">{m.symbol.slice(0, 2)}</span>}
                  <span className="truncate text-[13px] font-bold text-[var(--ink)]">{m.symbol}</span>
                  {m.kind === "stock" && <span className="rounded bg-blue-500/10 px-1 text-[8px] font-bold uppercase text-blue-600">stock</span>}
                </span>
                <span className="text-right text-xs font-semibold tabular-nums text-[var(--ink)]">{m.priceUsd != null ? formatPrice(m.priceUsd) : "—"}</span>
                <span className={`flex items-center justify-end gap-0.5 text-[11px] font-semibold tabular-nums ${m.change24h == null ? "text-[var(--ink-muted)]" : up ? "text-green-600" : "text-red-600"}`}>
                  {m.change24h == null ? "—" : (<>{up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{Math.abs(m.change24h).toFixed(1)}%</>)}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
