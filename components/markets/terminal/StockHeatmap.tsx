"use client";

import { useEffect, useRef, useState } from "react";
import { treemap, type MarketItem } from "@/lib/markets/board";
import { Pick, frame } from "./MarketBits";

/** Green rose, red fell; stronger colour for a bigger move. White text stays readable on all. */
function tileColor(change: number | null): string {
  if (change === null) return "rgb(71, 85, 105)";
  const strength = Math.min(1, Math.abs(change) / 6);
  const [from, to] = change >= 0 ? [[40, 90, 72], [4, 120, 70]] : [[110, 62, 70], [185, 28, 40]];
  return `rgb(${from!.map((v, i) => Math.round(v + (to![i]! - v) * strength)).join(", ")})`;
}

/** Stocks as boxes: bigger means more trading today. */
export default function StockHeatmap({ items, loading, onPick }: { items: MarketItem[]; loading: boolean; onPick?: (address: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1100, h: 380 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const watch = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // Fewer boxes on a narrow screen, so each stays big enough to read and tap.
  const count = size.w < 500 ? 12 : size.w < 800 ? 18 : 24;
  const stocks = items
    .filter((x) => x.kind === "stock" && (x.volume24h ?? 0) > 0)
    .sort((a, b) => b.volume24h! - a.volume24h!)
    .slice(0, count);
  // Square roots keep the smaller stocks visible beside the giants.
  const tiles = treemap(stocks.map((s) => ({ item: s, weight: Math.sqrt(s.volume24h!) })), size.w / Math.max(1, size.h));

  return (
    <section aria-labelledby="heatmap-title" className={`${frame} p-3 sm:p-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 pb-2">
        <h2 id="heatmap-title" className="text-[17px] font-bold text-[var(--ink)]">Stock heatmap</h2>
        <p className="text-[13px] text-[var(--ink-muted)]">Bigger box, more trading. Green rose, red fell.</p>
      </div>
      <div ref={ref} className="relative h-[300px] overflow-hidden rounded-2xl sm:h-[380px]">
        {tiles.length === 0 ? (
          <p role="status" className="grid h-full place-items-center text-[13px] text-[var(--ink-muted)]">
            {loading ? "Loading prices…" : "Prices are not available right now."}
          </p>
        ) : (
          <ul>
            {tiles.map(({ item, x, y, w, h }) => {
              const wide = (w / 100) * size.w;
              const tall = (h / 100) * size.h;
              const change = item.change24h === null ? "—" : `${item.change24h >= 0 ? "+" : ""}${item.change24h.toFixed(1)}%`;
              return (
                <li key={item.address} className="absolute p-px" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}>
                  <Pick address={item.address} onPick={onPick} className="relative isolate flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-md !text-center text-white transition hover:brightness-110">
                    <span className="absolute inset-px -z-10 rounded-md" style={{ background: tileColor(item.change24h) }} />
                    <span className="sr-only">{`${item.name} ${change}`}</span>
                    {wide >= 44 && tall >= 22 && <span aria-hidden className="font-display text-[13px] font-bold leading-tight sm:text-[15px]">{item.symbol.replace(/c$/, "")}</span>}
                    {wide >= 52 && tall >= 42 && <span aria-hidden className="text-[13px] font-bold leading-tight">{change}</span>}
                  </Pick>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
