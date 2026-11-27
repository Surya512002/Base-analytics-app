"use client";

import { Flame, Rocket, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { mostTradedItems, newestLaunches, topGainers, topLosers, type MarketItem } from "@/lib/markets/board";
import { Logo, Pick, compactUsd, frame, priceText } from "./MarketBits";

const SOLID = "border border-[#2f7bff] bg-[linear-gradient(140deg,#0a63ff,#0035b3_75%)] text-white";
const NAVY = "border border-[#2b3b80] bg-[linear-gradient(140deg,#101a3c,#1b2a63)] text-white";

/** Four things worth a look right now, each opening in the Markets terminal. */
export default function MarketHighlights({ items, loading, onPick }: { items: MarketItem[]; loading: boolean; onPick?: (address: string) => void }) {
  const cards: Array<{ title: string; icon: LucideIcon; item: MarketItem | undefined; tone: string; note: (x: MarketItem) => string }> = [
    { title: "Top gainer", icon: TrendingUp, item: topGainers(items, 1)[0], tone: SOLID, note: (x) => (x.change24h === null ? "" : `+${x.change24h.toFixed(2)}% today`) },
    { title: "Most traded", icon: Flame, item: mostTradedItems(items, 1)[0], tone: "", note: (x) => `${compactUsd(x.volume24h)} in 24h` },
    { title: "Biggest fall", icon: TrendingDown, item: topLosers(items, 1)[0], tone: "", note: (x) => (x.change24h === null ? "" : `${x.change24h.toFixed(2)}% today`) },
    { title: "Newest launch", icon: Rocket, item: newestLaunches(items, 1)[0], tone: NAVY, note: (x) => (x.priceUsd === null ? "No pool yet" : "Launched here") },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ title, icon: Icon, item, tone, note }) => {
        const dark = Boolean(tone);
        const muted = dark ? "text-white/90" : "text-[var(--ink-muted)]";
        const body = (
          <>
            <span className={`flex items-center gap-1.5 text-[13px] font-bold ${muted}`}>
              <Icon size={16} aria-hidden /> {title}
            </span>
            {item ? (
              <>
                <span className="flex min-w-0 items-center gap-2">
                  <Logo item={item} size={36} />
                  <span className="font-display truncate text-lg font-bold">{item.symbol}</span>
                </span>
                <span className="font-display text-2xl font-bold tabular-nums">{priceText(item.priceUsd)}</span>
                <span className={`text-[13px] font-bold ${muted}`}>{note(item)}</span>
              </>
            ) : (
              <span className={`py-6 text-[13px] ${muted}`}>{loading ? "Loading…" : "Nothing to show yet."}</span>
            )}
          </>
        );
        const box = `${tone || `${frame} text-[var(--ink)]`} flex h-full min-h-[148px] w-full min-w-0 flex-col gap-2 rounded-3xl p-4`;
        return (
          <li key={title} className="min-w-0">
            {item ? (
              <Pick address={item.address} onPick={onPick} className={`${box} transition duration-200 hover:-translate-y-0.5 active:scale-[0.98]`}>
                {body}
              </Pick>
            ) : (
              <div role="status" className={box}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
