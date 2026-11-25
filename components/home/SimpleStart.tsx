"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import TokenLogo from "@/components/ui/TokenLogo";
import { useStockMarkets } from "@/hooks/useMarketsData";
import { AUTO_INVEST_HREF, STOCK_LIST_HREF } from "@/lib/constants/destinations";
import { mostTraded } from "@/lib/markets/most-traded";

const ACTIONS = [
  { href: "/trade", title: "Buy a stock", note: "Pick one and pay with USDC or ETH" },
  { href: AUTO_INVEST_HREF, title: "Invest every week", note: "Set it once, cancel any time" },
  { href: "/lend", title: "Earn or borrow", note: "Put the stocks you hold to work" },
] as const;

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Home: three things to do, then the stocks people are trading today. */
export default function SimpleStart() {
  const { stocks, loading } = useStockMarkets();
  const popular = mostTraded(stocks, 3);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-4">
      <h2 className="text-2xl font-black tracking-tight text-[var(--ink)] sm:text-3xl">What would you like to do?</h2>

      <nav aria-label="Start here" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ACTIONS.map((a, i) => (
          <Link
            key={a.href}
            href={a.href}
            className={`flex min-h-[80px] flex-col justify-center gap-1 rounded-3xl border px-5 py-4 transition active:scale-[0.99] sm:min-h-[128px] ${
              i === 0
                ? "border-[var(--brand)] bg-[var(--brand)] text-white hover:opacity-95"
                : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand)]"
            }`}
          >
            <span className="text-lg font-black">{a.title}</span>
            <span className={`text-xs ${i === 0 ? "text-white/90" : "text-[var(--ink-muted)]"}`}>{a.note}</span>
          </Link>
        ))}
      </nav>

      <section aria-labelledby="popular-today" className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 id="popular-today" className="text-sm font-black text-[var(--ink)]">Popular today</h3>
          <Link href={STOCK_LIST_HREF} className="flex min-h-[44px] items-center text-xs font-bold text-[var(--brand-text)]">
            See all stocks
          </Link>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)] rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)]">
          {popular.map((s) => (
            <li key={s.address}>
              <Link href={`/trade?token=${s.address}`} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
                <TokenLogo address={s.address} symbol={s.symbol} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-[var(--ink)]">{s.name}</span>
                  <span className="block text-xs text-[var(--ink-muted)]">{s.symbol}</span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block text-sm font-bold text-[var(--ink)]">{usd(s.price)}</span>
                  {/* The feed sends 0 when it has no change figure, so 0 is not shown. */}
                  {s.change24h !== 0 && (
                    <span className={`block text-xs font-bold ${s.change24h > 0 ? "text-[var(--success-text)]" : "text-rose-600 dark:text-rose-400"}`}>
                      {s.change24h > 0 ? "+" : ""}
                      {s.change24h.toFixed(2)}% today
                    </span>
                  )}
                </span>
                <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--ink-dim)]" />
              </Link>
            </li>
          ))}
          {popular.length === 0 && (
            <li role="status" className="px-4 py-6 text-center text-xs text-[var(--ink-muted)]">
              {loading ? "Loading prices…" : "Prices are not available right now."}
            </li>
          )}
        </ul>
      </section>

      <p className="flex flex-wrap justify-center gap-x-6 text-xs font-bold text-[var(--ink-muted)]">
        <Link href="/explore" className="flex min-h-[44px] items-center underline underline-offset-4">Explore all tokens</Link>
        <Link href="/launch" className="flex min-h-[44px] items-center underline underline-offset-4">Launch a token</Link>
      </p>
    </div>
  );
}
