"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PieChart, Plus, RefreshCw, Scale, Trash2, TrendingUp, Wallet } from "lucide-react";
import { useWalletHoldings } from "@/hooks/useWalletHoldings";
import { BASE_OFFICIAL_STOCKS } from "@/lib/stocks/base-verified";
import { buildSwapLink } from "@/lib/swap/swap-link";
import { USDC_BASE } from "@/lib/utils/voucher";
import { BASKETS } from "./basket-math";
import {
  MAX_TARGET_STOCKS,
  allocation,
  drift,
  equalTargets,
  planRebalance,
  validateTargets,
  type Targets,
} from "@/lib/stocks/portfolio-math";
import type { AssetMarketRow } from "@/components/lending/MarketsTable";

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toFixed(1)}%`;
const storeKey = (wallet: string) => `stock_portfolio_targets_v1_${wallet.toLowerCase()}`;

function readTargets(wallet: string): Targets | null {
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey(wallet)) ?? "null") as Targets | null;
    if (!raw || typeof raw !== "object") return null;
    const clean: Targets = {};
    for (const [k, v] of Object.entries(raw)) if (typeof v === "number" && BASE_OFFICIAL_STOCKS.some((s) => s.symbol === k)) clean[k] = v;
    return validateTargets(clean) === null ? clean : null;
  } catch {
    return null;
  }
}

/**
 * Your tokenized stocks as one portfolio: what you hold, the mix you want, how far you have drifted,
 * the trades that fix it, and where each stock can earn. Nothing here moves money by itself: every
 * trade opens the normal Swap with the amount filled in, so the usual quote, price-impact, region
 * and wallet checks all still apply.
 */
export default function StockPortfolio({
  walletAddress,
  onRequestConnect,
  rows,
  onOpenStock,
}: {
  walletAddress: string | null;
  onRequestConnect?: () => void;
  rows: AssetMarketRow[];
  onOpenStock: (symbol: string) => void;
}) {
  const holdings = useWalletHoldings(walletAddress);
  const official = useMemo(() => new Map(BASE_OFFICIAL_STOCKS.map((s) => [s.symbol, s])), []);
  const byAddress = useMemo(() => new Map(BASE_OFFICIAL_STOCKS.map((s) => [s.address.toLowerCase(), s.symbol])), []);
  const rowBySymbol = useMemo(() => new Map(rows.map((r) => [r.symbol, r])), [rows]);

  // Held stocks keyed by their official symbol (matched by address, so a look-alike symbol never counts).
  const held = useMemo(() => {
    const out: Array<{ symbol: string; address: `0x${string}`; balance: number; valueUsd: number; price: number | null }> = [];
    for (const t of holdings.allTokens) {
      if (!t.address || t.isSpam || t.balanceNumber <= 0) continue;
      const symbol = byAddress.get(t.address.toLowerCase());
      if (!symbol) continue;
      out.push({ symbol, address: t.address, balance: t.balanceNumber, valueUsd: t.usdValue, price: t.priceUsd });
    }
    return out;
  }, [holdings.allTokens, byAddress]);

  const totalUsd = held.reduce((s, h) => s + (h.valueUsd > 0 ? h.valueUsd : 0), 0);
  const alloc = useMemo(() => allocation(held.map((h) => ({ symbol: h.symbol, valueUsd: h.valueUsd }))), [held]);

  const [targets, setTargets] = useState<Targets | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [cash, setCash] = useState("");

  useEffect(() => {
    if (!walletAddress) return;
    setTargets(readTargets(walletAddress));
  }, [walletAddress]);

  const draftTargets: Targets = useMemo(() => {
    const out: Targets = {};
    for (const [k, v] of Object.entries(draft)) out[k] = Number(v);
    return out;
  }, [draft]);
  const draftError = editing ? validateTargets(draftTargets) : null;

  const startEdit = (base?: Targets | null) => {
    const seed = base ?? targets ?? (alloc.length >= 2 ? equalTargets(alloc.slice(0, MAX_TARGET_STOCKS).map((r) => r.symbol)) : {});
    setDraft(Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, String(v)])));
    setEditing(true);
  };
  const save = () => {
    if (!walletAddress || validateTargets(draftTargets) !== null) return;
    try {
      localStorage.setItem(storeKey(walletAddress), JSON.stringify(draftTargets));
    } catch {
      /* private mode: still works for this visit */
    }
    setTargets(draftTargets);
    setEditing(false);
  };
  const clear = () => {
    if (walletAddress) {
      try {
        localStorage.removeItem(storeKey(walletAddress));
      } catch {
        /* ignore */
      }
    }
    setTargets(null);
    setEditing(false);
  };

  const extraCash = Math.max(0, Number(cash) || 0);
  const holdingsForMath = useMemo(() => held.map((h) => ({ symbol: h.symbol, valueUsd: h.valueUsd })), [held]);
  const driftView = useMemo(() => (targets ? drift(holdingsForMath, targets, extraCash) : null), [targets, holdingsForMath, extraCash]);
  const plan = useMemo(() => (targets ? planRebalance(holdingsForMath, targets, { extraCashUsd: extraCash }) : null), [targets, holdingsForMath, extraCash]);

  if (!walletAddress) {
    return (
      <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 text-center">
        <Wallet className="mx-auto mb-2 text-[var(--brand-text)]" size={22} />
        <h2 className="text-base font-black text-[var(--ink)]">My Stocks</h2>
        <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--ink-muted)]">Connect a wallet to see your tokenized stocks as one portfolio, set a target mix and rebalance it.</p>
        {onRequestConnect && (
          <button type="button" onClick={onRequestConnect} className="mt-4 min-h-[44px] rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white hover:opacity-90">
            Connect wallet
          </button>
        )}
      </section>
    );
  }

  const unusedStocks = BASE_OFFICIAL_STOCKS.filter((s) => !(s.symbol in draft));
  const liveBaskets = BASKETS.filter((b) => b.symbols.filter((s) => official.has(s)).length >= 2);

  return (
    <section aria-label="My stocks" className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-text)]">
            <PieChart size={18} />
          </span>
          <div>
            <h2 className="text-base font-black text-[var(--ink)]">My Stocks</h2>
            <p className="text-xs text-[var(--ink-muted)]">
              {held.length === 0 ? "No tokenized stocks in this wallet yet." : `${held.length} stock${held.length === 1 ? "" : "s"} · ${usd(totalUsd)}`}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => void holdings.refresh?.()} aria-label="Refresh holdings" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)]">
          <RefreshCw size={14} className={holdings.loading ? "animate-spin" : ""} />
        </button>
      </div>

      {held.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-6 text-center text-xs text-[var(--ink-muted)]">
          Buy a stock or a basket first, then come back to set your mix.
          <div className="mt-3">
            <Link href="/explore" className="inline-flex min-h-[40px] items-center rounded-xl bg-[var(--brand)] px-4 text-xs font-bold text-white">
              Browse stocks
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)]">
          <ul className="divide-y divide-[var(--border-subtle)]">
            {alloc.map((a) => {
              const h = held.find((x) => x.symbol === a.symbol)!;
              const row = rowBySymbol.get(a.symbol);
              const d = driftView?.rows.find((r) => r.symbol === a.symbol);
              return (
                <li key={a.symbol} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:p-4">
                  <span className="min-w-[88px]">
                    <span className="block text-sm font-black text-[var(--ink)]">{a.symbol}</span>
                    <span className="block text-[11px] text-[var(--ink-muted)]">{usd(a.valueUsd)}</span>
                  </span>
                  <span className="min-w-[120px] flex-1">
                    <span className="flex justify-between text-[11px] font-bold text-[var(--ink-soft)]">
                      <span>{pct(a.weightPct)}</span>
                      {d && <span className={Math.abs(d.driftPts) >= 3 ? "text-amber-600 dark:text-amber-300" : "text-[var(--ink-muted)]"}>target {pct(d.targetPct)}</span>}
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.min(100, a.weightPct)}%` }} />
                    </span>
                  </span>
                  <span className="min-w-[96px] text-right text-[11px] text-[var(--ink-muted)]">
                    {row && row.bestSupplyApy > 0 ? (
                      <button type="button" onClick={() => onOpenStock(a.symbol)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 font-bold text-emerald-700 dark:text-emerald-300">
                        <TrendingUp size={11} /> Earn {row.bestSupplyApy.toFixed(1)}%
                      </button>
                    ) : (
                      <button type="button" onClick={() => onOpenStock(a.symbol)} className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 font-bold">
                        Markets
                      </button>
                    )}
                    {row && row.bestSupplyApy > 0 && <span className="mt-0.5 block truncate">{row.bestSupplyProtocol}</span>}
                  </span>
                  <span className="sr-only">{h.balance} tokens</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="space-y-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-black text-[var(--ink)]">
            <Scale size={15} /> Target mix
          </h3>
          {!editing && (
            <button type="button" onClick={() => startEdit()} className="min-h-[34px] rounded-full border border-[var(--border-subtle)] px-3 text-xs font-bold text-[var(--ink-soft)]">
              {targets ? "Edit" : "Set a target"}
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {liveBaskets.map((b) => (
                <button key={b.id} type="button" onClick={() => startEdit(equalTargets(b.symbols.filter((s) => official.has(s))))} className="min-h-[32px] rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 text-[11px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)]">
                  {b.title}
                </button>
              ))}
              <button type="button" onClick={() => startEdit(equalTargets(Object.keys(draft)))} className="min-h-[32px] rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 text-[11px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)]">
                Equal split
              </button>
            </div>
            <ul className="space-y-1.5">
              {Object.keys(draft).map((sym) => (
                <li key={sym} className="flex items-center gap-2">
                  <span className="min-w-[72px] text-sm font-black text-[var(--ink)]">{sym}</span>
                  <input
                    aria-label={`${sym} share in percent`}
                    inputMode="decimal"
                    value={draft[sym]}
                    onChange={(e) => setDraft((d) => ({ ...d, [sym]: e.target.value.replace(/[^0-9.]/g, "").slice(0, 6) }))}
                    className="min-h-[38px] w-20 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 text-center text-sm font-bold text-[var(--ink)]"
                  />
                  <span className="text-xs text-[var(--ink-muted)]">%</span>
                  <button type="button" aria-label={`Remove ${sym}`} onClick={() => setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== sym)))} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-muted)] hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            {Object.keys(draft).length < MAX_TARGET_STOCKS && (
              <label className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
                <Plus size={13} />
                <select
                  aria-label="Add a stock"
                  value=""
                  onChange={(e) => e.target.value && setDraft((d) => ({ ...d, [e.target.value]: "5" }))}
                  className="min-h-[36px] flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 text-xs font-bold text-[var(--ink)]"
                >
                  <option value="">Add a stock…</option>
                  {unusedStocks.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} — {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {draftError && (
              <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                {draftError}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" disabled={draftError !== null} onClick={save} className="min-h-[40px] flex-1 rounded-xl bg-[var(--brand)] text-sm font-bold text-white disabled:opacity-40">
                Save target
              </button>
              <button type="button" onClick={() => setEditing(false)} className="min-h-[40px] rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-bold text-[var(--ink-soft)]">
                Cancel
              </button>
              {targets && (
                <button type="button" onClick={clear} className="min-h-[40px] rounded-xl px-3 text-xs font-bold text-red-500">
                  Remove
                </button>
              )}
            </div>
          </div>
        ) : targets ? (
          <p className="text-xs text-[var(--ink-muted)]">
            {Object.entries(targets)
              .map(([s, p]) => `${s} ${p}%`)
              .join(" · ")}
          </p>
        ) : (
          <p className="text-xs text-[var(--ink-muted)]">Pick the share you want in each stock. We show how far you have drifted and the trades that bring you back.</p>
        )}
      </div>

      {targets && plan && (
        <div className="space-y-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black text-[var(--ink)]">Rebalance</h3>
            <label className="flex items-center gap-2 text-xs font-bold text-[var(--ink-soft)]">
              Add USDC
              <input
                aria-label="Extra USDC to invest"
                inputMode="decimal"
                value={cash}
                placeholder="0"
                onChange={(e) => setCash(e.target.value.replace(/[^0-9.]/g, "").slice(0, 8))}
                className="min-h-[36px] w-20 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 text-center text-sm font-bold text-[var(--ink)]"
              />
            </label>
          </div>
          {plan.balanced ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              You are within 3 points of your target. Nothing to do.
            </p>
          ) : (
            <>
              <p className="text-xs text-[var(--ink-muted)]">
                Your biggest gap is {plan.maxDriftPts.toFixed(1)} points. Do the sells first, then the buys. Each trade opens Swap with the amount filled in.
              </p>
              <ul className="space-y-1.5">
                {plan.sells.map((l) => {
                  const h = held.find((x) => x.symbol === l.symbol);
                  const qty = h && h.price && h.price > 0 ? Math.min(h.balance, l.usd / h.price) : null;
                  return (
                    <li key={`s-${l.symbol}`} className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 p-2.5">
                      <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-black uppercase text-red-600 dark:text-red-300">Sell</span>
                      <span className="flex-1 text-sm font-black text-[var(--ink)]">{l.symbol}</span>
                      <span className="text-sm font-bold text-[var(--ink)]">{usd(l.usd)}</span>
                      {h && qty ? (
                        <Link href={buildSwapLink({ sell: h.address, buy: USDC_BASE, amount: qty.toFixed(6) })} className="inline-flex min-h-[38px] items-center rounded-xl bg-[var(--brand)] px-3 text-xs font-bold text-white">
                          Sell
                        </Link>
                      ) : (
                        <span className="text-[11px] text-[var(--ink-muted)]">no price</span>
                      )}
                    </li>
                  );
                })}
                {plan.buys.map((l) => {
                  const s = official.get(l.symbol);
                  return (
                    <li key={`b-${l.symbol}`} className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 p-2.5">
                      <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-300">Buy</span>
                      <span className="flex-1 text-sm font-black text-[var(--ink)]">{l.symbol}</span>
                      <span className="text-sm font-bold text-[var(--ink)]">{usd(l.usd)}</span>
                      {s && (
                        <Link href={buildSwapLink({ sell: USDC_BASE, buy: s.address, amount: l.usd.toFixed(2) })} className="inline-flex min-h-[38px] items-center rounded-xl bg-[var(--brand)] px-3 text-xs font-bold text-white">
                          Buy
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
              {plan.note && <p className="text-[11px] text-[var(--ink-muted)]">{plan.note}</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
