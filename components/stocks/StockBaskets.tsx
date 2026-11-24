"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ShoppingBasket } from "lucide-react";
import { BASE_OFFICIAL_STOCKS } from "@/lib/stocks/base-verified";
import { buildSwapLink } from "@/lib/swap/swap-link";
import { USDC_BASE } from "@/lib/utils/voucher";
import { basketLegs, BASKETS } from "./basket-math";
import { equalTargets, mixReturnPct } from "@/lib/stocks/portfolio-math";
import { signedPct, useStockReturns } from "@/hooks/useStockReturns";

const AMOUNTS = [10, 25, 50, 100];
const storeKey = (basket: string) => `stock_basket_opened_${basket}`;

/**
 * Stock baskets: pick a theme, enter a USDC amount, and buy each stock in it with one tap.
 * Every leg opens the normal Swap with the amount filled in, so each buy keeps the usual quote,
 * price-impact, region and wallet checks. Nothing is bought until you confirm each one.
 */
export default function StockBaskets() {
  const live = useMemo(() => new Map(BASE_OFFICIAL_STOCKS.map((s) => [s.symbol, s])), []);
  const baskets = useMemo(() => BASKETS.filter((b) => b.symbols.filter((s) => live.has(s)).length >= 2), [live]);
  const [basketId, setBasketId] = useState(baskets[0]?.id ?? "");
  const [total, setTotal] = useState(25);
  const [opened, setOpened] = useState<string[]>([]);

  const basket = baskets.find((b) => b.id === basketId) ?? baskets[0];
  const returns = useStockReturns(useMemo(() => baskets.flatMap((b) => b.symbols), [baskets]));
  // Equal-weight, buy-and-hold: each stock's move weighted by its share, only over stocks with enough history.
  const basketReturns = useMemo(() => {
    if (!basket) return [];
    const t = equalTargets(basket.symbols.filter((s) => live.has(s)));
    return ([30, 90] as const).map((d) => ({ d, ...mixReturnPct(t, Object.fromEntries(Object.entries(returns).map(([k, v]) => [k, v?.[d]]))) }));
  }, [basket, live, returns]);
  const legs = useMemo(() => (basket ? basketLegs(basket.symbols.filter((s) => live.has(s)), total) : null), [basket, live, total]);

  useEffect(() => {
    if (!basket) return;
    try {
      setOpened(JSON.parse(localStorage.getItem(storeKey(basket.id)) ?? "[]") as string[]);
    } catch {
      setOpened([]);
    }
  }, [basket]);

  if (!basket || !legs) return null;

  const markOpened = (symbol: string) => {
    const next = [...new Set([...opened, symbol])];
    setOpened(next);
    try {
      localStorage.setItem(storeKey(basket.id), JSON.stringify(next));
    } catch {
      /* private mode */
    }
  };

  return (
    <section aria-label="Stock baskets" className="space-y-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-text)]">
          <ShoppingBasket size={18} />
        </span>
        <div>
          <h2 className="text-base font-black text-[var(--ink)]">Stock baskets</h2>
          <p className="text-xs text-[var(--ink-muted)]">Spread USDC across a theme in a few taps. Each buy opens Swap with the amount filled in.</p>
        </div>
      </div>

      <div role="radiogroup" aria-label="Basket" className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {baskets.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={b.id === basket.id}
            onClick={() => setBasketId(b.id)}
            className={`min-h-[36px] shrink-0 rounded-full border px-3.5 text-xs font-bold transition ${
              b.id === basket.id ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {b.title}
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--ink-muted)]">{basket.note}</p>
      {basketReturns.some((r) => r.returnPct !== null) && (
        <p className="flex flex-wrap gap-x-4 text-xs font-bold text-[var(--ink-soft)]">
          {basketReturns.map((r) =>
            r.returnPct === null ? null : (
              <span key={r.d} className={r.returnPct >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-red-500"}>
                {r.d}d {signedPct(r.returnPct)}
                <span className="font-normal text-[var(--ink-muted)]"> (DEX prices, {Math.round(r.covered)}% of basket)</span>
              </span>
            )
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-bold text-[var(--ink-soft)]" htmlFor="basket-total">
          Total (USDC)
        </label>
        <input
          id="basket-total"
          inputMode="numeric"
          className="min-h-[40px] w-24 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 text-center text-sm font-black text-[var(--ink)] outline-none focus:border-[var(--brand-text)]"
          value={String(total)}
          onChange={(e) => setTotal(Math.min(10_000, Number(e.target.value.replace(/\D/g, "")) || 0))}
        />
        {AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setTotal(a)}
            className={`min-h-[34px] rounded-full border px-3 text-xs font-bold ${total === a ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}
          >
            ${a}
          </button>
        ))}
      </div>

      {legs.error ? (
        <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
          {legs.error}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {legs.items.map((l) => {
            const stock = live.get(l.symbol)!;
            const done = opened.includes(l.symbol);
            return (
              <li key={l.symbol} className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 p-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-[var(--ink)]">{l.symbol}</span>
                  <span className="block truncate text-[11px] text-[var(--ink-muted)]">{stock.name}</span>
                </span>
                <span className="text-sm font-bold text-[var(--ink)]">${l.amount}</span>
                <Link
                  href={buildSwapLink({ sell: USDC_BASE, buy: stock.address, amount: l.amount })}
                  onClick={() => markOpened(l.symbol)}
                  className={`inline-flex min-h-[38px] min-w-[72px] items-center justify-center gap-1 rounded-xl px-3 text-xs font-bold ${
                    done ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-[var(--brand)] text-white hover:opacity-90"
                  }`}
                >
                  {done ? (
                    <>
                      <Check size={12} /> Opened
                    </>
                  ) : (
                    "Buy"
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[11px] text-[var(--ink-muted)]">
        Equal amounts per stock. You confirm every buy in your wallet, and some stocks aren&apos;t available in every region. Not investment advice.
      </p>
    </section>
  );
}
