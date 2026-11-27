"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Star } from "lucide-react";
import CandleChart, { type Candle } from "@/components/trade/CandleChart";
import DexSwapCard from "@/components/swap/DexSwapCard";
import ShareCount from "@/components/stocks/ShareCount";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { USDC_BASE } from "@/lib/launchpad/tokens-base";
import { resolveSwapToken } from "@/lib/swap/token-metadata";
import { mostTradedItems, topGainers, topLosers, type MarketItem } from "@/lib/markets/board";
import { Change, Logo, compactUsd, frame, priceText } from "./MarketBits";

const USDC: SwapCounter = { kind: "token", address: USDC_BASE, symbol: "USDC", name: "USD Coin", decimals: 6, isVerified: true, isUnverified: false };
const TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"] as const;
const FILTERS = [
  ["all", "All"],
  ["stock", "Stocks"],
  ["token", "Tokens"],
  ["launched", "Launched here"],
  ["gain", "Gainers"],
  ["lose", "Losers"],
  ["volume", "Most traded"],
  ["watch", "Watchlist"],
] as const;
type Filter = (typeof FILTERS)[number][0];

const chip = (on: boolean) =>
  `min-h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3 text-[13px] font-bold transition ${
    on ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--ink)] hover:text-[var(--brand-text)]"
  }`;

function filterItems(items: MarketItem[], filter: Filter, query: string, watchlist: string[]): MarketItem[] {
  const q = query.trim().toLowerCase();
  const base =
    filter === "gain" ? topGainers(items, 50)
    : filter === "lose" ? topLosers(items, 50)
    : filter === "volume" ? mostTradedItems(items, 50)
    : (filter === "watch" ? items.filter((x) => watchlist.includes(x.address.toLowerCase()))
      : filter === "all" ? [...items]
      : items.filter((x) => x.kind === filter)
    ).sort((a, b) => (b.volume24h ?? -1) - (a.volume24h ?? -1));
  return q ? base.filter((x) => x.symbol.toLowerCase().includes(q) || x.name.toLowerCase().includes(q) || x.address.toLowerCase() === q) : base;
}

function PriceChart({ item }: { item: MarketItem }) {
  const [tf, setTf] = useState<(typeof TIMEFRAMES)[number]>("1h");
  const [data, setData] = useState<{ key: string; candles: Candle[]; note: string | null }>({ key: "", candles: [], note: null });
  const key = `${item.address}-${tf}`;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/trade/candles?address=${item.address}&tf=${tf}`);
        const d = (await r.json()) as { candles?: Candle[]; note?: string; error?: string };
        if (alive) setData({ key, candles: d.candles ?? [], note: d.error ?? d.note ?? null });
      } catch {
        if (alive) setData({ key, candles: [], note: "Chart data is unavailable right now." });
      }
    };
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [item.address, tf, key]);

  const ready = data.key === key;
  // Beside the order form (wide screens) the chart is as tall as that column.
  const [height, setHeight] = useState(360);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1280px)");
    const fit = () => setHeight(wide.matches ? 640 : 360);
    fit();
    wide.addEventListener("change", fit);
    return () => wide.removeEventListener("change", fit);
  }, []);
  return (
    <section aria-label={`${item.symbol} price chart`} className={`${frame} min-w-0 p-3`}>
      <div className="flex flex-wrap items-center gap-3">
        <Logo item={item} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--ink)]">
            {item.symbol} <span className="font-normal text-[var(--ink-muted)]">{item.name}</span>
          </p>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-2xl font-bold tabular-nums text-[var(--ink)]">{priceText(item.priceUsd)}</span>
            <Change value={item.change24h} className="text-sm" />
          </p>
          {item.kind === "stock" && (
            <ShareCount token={item.address as `0x${string}`} tokens={1} prefix="1 token " className="block text-[13px] font-bold text-[var(--ink-muted)]" />
          )}
        </div>
        <p className="text-right text-[13px] text-[var(--ink-muted)]">
          24h volume
          <b className="block text-sm tabular-nums text-[var(--ink)]">{compactUsd(item.volume24h)}</b>
        </p>
      </div>
      <div role="group" aria-label="Time per candle" className="flex gap-1.5 py-2.5">
        {TIMEFRAMES.map((t) => (
          <button key={t} type="button" aria-pressed={tf === t} onClick={() => setTf(t)} className={chip(tf === t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="relative" style={{ minHeight: height }}>
        {ready && data.candles.length > 0 ? (
          <CandleChart candles={data.candles} intraday={tf !== "1d"} height={height} />
        ) : (
          <p role="status" style={{ height }} className="grid place-items-center px-4 text-center text-[13px] text-[var(--ink-muted)]">
            {!ready ? <Loader2 size={22} aria-label="Loading chart" className="animate-spin" /> : data.note ?? "No chart for this token yet."}
          </p>
        )}
      </div>
    </section>
  );
}

/** The trading terminal: every market in one list, the chart, and buy / sell beside it. */
export default function MarketTerminal({
  items,
  loading,
  selected,
  onSelect,
  watchlist,
  onToggleWatch,
  app,
  guestMode,
  onRequestConnect,
}: {
  items: MarketItem[];
  loading: boolean;
  selected: MarketItem | null;
  onSelect: (address: string) => void;
  watchlist: string[];
  onToggleWatch: (address: string) => void;
  app: WalletAppState;
  guestMode: boolean;
  onRequestConnect?: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const rows = useMemo(() => filterItems(items, filter, query, watchlist), [items, filter, query, watchlist]);

  // Name and decimals come from the token itself, as on the Swap screen, never from a price feed.
  const address = selected?.address ?? null;
  const [token, setToken] = useState<{ address: string; counter: SwapCounter | null; error?: string } | null>(null);
  useEffect(() => {
    if (!address) return;
    let alive = true;
    void resolveSwapToken(address).then((r) => {
      if (alive) setToken({ address, counter: r.counter, error: r.error });
    });
    return () => {
      alive = false;
    };
  }, [address]);
  const ready = token && token.address === address ? token : null;

  return (
    <div id="terminal" className="grid scroll-mt-24 grid-cols-1 gap-3 lg:grid-cols-[290px_minmax(0,1fr)] lg:items-start xl:grid-cols-[280px_minmax(0,1fr)_380px]">
      <section aria-label="All markets list" className={`${frame} order-2 flex min-w-0 flex-col gap-2 p-3 lg:order-none lg:row-span-2 xl:row-span-1`}>
        <label className="relative block">
          <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stocks and tokens"
            aria-label="Search stocks and tokens"
            className="min-h-11 w-full rounded-2xl border border-[var(--edge)] bg-[var(--surface-2)] pl-9 pr-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
          />
        </label>
        <div role="group" aria-label="Show" className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={chip(filter === id)}>
              {label}
            </button>
          ))}
        </div>
        <ul className="max-h-[420px] min-h-40 overflow-y-auto lg:max-h-[640px] xl:max-h-[760px]">
          {rows.length === 0 && (
            <li role="status" className="px-2 py-6 text-center text-[13px] text-[var(--ink-muted)]">
              {loading ? "Loading markets…" : filter === "watch" ? "Star a market to keep it here." : "Nothing matches."}
            </li>
          )}
          {rows.map((x) => {
            const on = selected?.address === x.address;
            const watched = watchlist.includes(x.address.toLowerCase());
            return (
              <li key={x.address} className={`flex items-center rounded-2xl ${on ? "bg-[var(--brand-soft)]" : "hover:bg-[var(--surface-2)]"}`}>
                <button
                  type="button"
                  aria-pressed={watched}
                  aria-label={watched ? `Remove ${x.symbol} from watchlist` : `Add ${x.symbol} to watchlist`}
                  onClick={() => onToggleWatch(x.address)}
                  className="grid h-11 w-8 shrink-0 cursor-pointer place-items-center"
                >
                  <Star size={14} aria-hidden className={watched ? "fill-amber-400 text-amber-500" : "text-[var(--ink-dim)]"} />
                </button>
                <button type="button" aria-current={on ? "true" : undefined} onClick={() => onSelect(x.address)} className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-2 py-1.5 pr-2 text-left">
                  <Logo item={x} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[var(--ink)]">{x.symbol}</span>
                    <span className="block truncate text-[13px] text-[var(--ink-muted)]">{x.kind === "launched" ? "Launched here" : x.name}</span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block text-sm font-bold text-[var(--ink)]">{priceText(x.priceUsd)}</span>
                    <Change value={x.change24h} className="block text-[13px]" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="order-1 min-w-0 lg:order-none">
        {selected ? (
          <PriceChart item={selected} />
        ) : (
          <p role="status" className={`${frame} grid h-[460px] place-items-center text-[13px] text-[var(--ink-muted)]`}>
            {loading ? "Loading markets…" : "Markets are not available right now."}
          </p>
        )}
      </div>

      {selected && (
        <div className="order-1 min-w-0 space-y-2 lg:order-none lg:col-start-2 xl:col-start-3">
          <div role="group" aria-label="Buy or sell" className="grid grid-cols-2 gap-1.5">
            {(["buy", "sell"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)} className={`${chip(side === s)} !min-h-11 text-sm`}>
                {s === "buy" ? "Buy" : "Sell"} {selected.symbol}
              </button>
            ))}
          </div>
          {ready?.counter ? (
            <DexSwapCard
              key={`${side}-${selected.address}`}
              app={app}
              guestMode={guestMode}
              compact
              onRequestConnect={onRequestConnect}
              prefillFromCounter={side === "sell" ? ready.counter : null}
              currentBuyToken={side === "buy" ? ready.counter : USDC}
            />
          ) : (
            <p role="status" className={`${frame} grid min-h-40 place-items-center px-4 text-center text-[13px] text-[var(--ink-muted)]`}>
              {ready ? ready.error ?? "This token cannot be traded here." : "Loading the order form…"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
