"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowDownUp,
  BadgeCheck,
  Calculator,
  ChevronDown,
  Coins,
  ExternalLink,
  HandCoins,
  Layers,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { NormalizedMarket } from "@/lib/lending/discovery/types";
import {
  borrowCapacity,
  groupMarketsByStock,
  isApyUnreliable,
  marketDepthUsd,
  yearlyEarnings,
  type StockMarketGroup,
  type StockMarketKind,
} from "@/lib/lending/stock-market-groups";
import ActivePill from "@/components/ui/motion/ActivePill";
import TokenLogo from "@/components/ui/TokenLogo";

type Mode = "all" | StockMarketKind;
type Sort = "earn" | "borrow" | "ltv" | "depth";
type GroupMarket = StockMarketGroup["markets"][number];

const MODES: Array<{ id: Mode; label: string; icon: React.ElementType }> = [
  { id: "all", label: "All", icon: Layers },
  { id: "lend", label: "Earn on stock", icon: Coins },
  { id: "borrow", label: "Borrow USDC", icon: HandCoins },
  { id: "lp", label: "Liquidity pools", icon: Sparkles },
];

const KIND_LABEL: Record<StockMarketKind, string> = { borrow: "Borrow", lend: "Lend", lp: "LP" };
const KIND_STYLE: Record<StockMarketKind, string> = {
  borrow: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  lend: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  lp: "bg-[var(--brand-soft)] text-[var(--brand-text)]",
};

const usd = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};
const pct = (n?: number | null) => (n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(n >= 100 ? 0 : 2)}%`);

/**
 * Verified stock markets on Base, one row per stock: best yield, cheapest borrow, max LTV and
 * depth across every protocol, with filters, a calculator, and side-by-side compare.
 * Every market here is verified by contract address against Base's official stock registry.
 */
export default function StockMarketsExplorer({
  markets,
  loading,
  onAction,
}: {
  markets: NormalizedMarket[];
  loading?: boolean;
  /** In-app action (Morpho borrow, single-stock vault deposit). LPs open the protocol instead. */
  onAction: (market: NormalizedMarket, action: "borrow" | "supply") => void;
}) {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>("all");
  const [query, setQuery] = useState("");
  const [venue, setVenue] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("earn");
  const [showSmall, setShowSmall] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const allGroups = useMemo(() => groupMarketsByStock(markets, showSmall ? 0 : 1000), [markets, showSmall]);
  const venues = useMemo(() => [...new Set(allGroups.flatMap((g) => g.venues))].sort(), [allGroups]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = allGroups
      .map((g) => ({
        ...g,
        markets: g.markets.filter((m) => (mode === "all" || m.kind === mode) && (!venue || m.venue === venue)),
      }))
      .filter((g) => g.markets.length > 0)
      .filter((g) => !q || g.symbol.toLowerCase().includes(q) || g.name.toLowerCase().includes(q));
    const key = (g: StockMarketGroup) =>
      sort === "earn"
        ? -(g.bestEarn?.supplyApy ?? -1)
        : sort === "borrow"
          ? g.bestBorrow?.borrowApr ?? 999
          : sort === "ltv"
            ? -g.maxLtv
            : -g.totalDepthUsd;
    return list.sort((a, b) => key(a) - key(b));
  }, [allGroups, mode, venue, query, sort]);

  const stats = useMemo(() => {
    const flat = allGroups.flatMap((g) => g.markets);
    const earn = flat.filter((m) => m.kind !== "borrow" && !isApyUnreliable(m)).sort((a, b) => b.supplyApy - a.supplyApy)[0];
    const borrow = flat
      .filter((m) => m.kind === "borrow" && (m.liquidityUsd || 0) > 0 && (m.borrowApr ?? 0) > 0)
      .sort((a, b) => (a.borrowApr ?? 99) - (b.borrowApr ?? 99))[0];
    return {
      stocks: allGroups.length,
      markets: flat.length,
      venues: venues.length,
      depth: flat.reduce((s, m) => s + marketDepthUsd(m), 0),
      earn,
      borrow,
    };
  }, [allGroups, venues]);

  const toggleCompare = (sym: string) =>
    setCompare((c) => (c.includes(sym) ? c.filter((x) => x !== sym) : c.length >= 3 ? c : [...c, sym]));
  const compared = allGroups.filter((g) => compare.includes(g.symbol));

  return (
    <section className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: "Stocks with markets", value: String(stats.stocks), note: `${stats.markets} verified markets`, icon: BadgeCheck, color: "#0052FF" },
          {
            label: "Best yield",
            value: pct(stats.earn?.supplyApy),
            note: stats.earn ? `${stats.earn.collateralAsset?.symbol ?? ""} · ${stats.earn.venue}` : "—",
            icon: Coins,
            color: "#10B981",
          },
          {
            label: "Cheapest borrow",
            value: pct(stats.borrow?.borrowApr),
            note: stats.borrow ? `USDC vs ${stats.borrow.collateralAsset?.symbol} · Morpho` : "No live borrow liquidity",
            icon: HandCoins,
            color: "#8B5CF6",
          },
          { label: "Total depth", value: usd(stats.depth), note: `${stats.venues} protocols`, icon: Layers, color: "#F59E0B" },
        ].map((s) => (
          <div key={s.label} className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 shadow-xs">
            <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: s.color }} />
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)]">
              <s.icon size={12} style={{ color: s.color }} /> {s.label}
            </p>
            <p className="mt-1 font-mono text-xl font-black tabular-nums text-[var(--ink)] sm:text-2xl">{loading && !stats.markets ? "…" : s.value}</p>
            <p className="truncate text-[11px] text-[var(--ink-muted)]">{s.note}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-xs">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="What do you want to do?" className="flex gap-1 overflow-x-auto rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1 no-scrollbar">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                onClick={() => setMode(m.id)}
                className={`relative isolate flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  mode === m.id ? "text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {mode === m.id && <ActivePill layoutId="stock-markets-mode" className="bg-[var(--brand)]" />}
                <m.icon size={13} /> {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label className="relative flex-1 lg:w-56 lg:flex-none">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-dim)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a stock (AAPL, Tesla…)"
                aria-label="Search stocks"
                className="w-full rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] py-2 pl-8 pr-3 text-xs text-[var(--ink)] outline-none focus:border-[var(--brand)]"
              />
            </label>
            <label className="relative">
              <ArrowDownUp size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-dim)]" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Sort"
                className="cursor-pointer appearance-none rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] py-2 pl-8 pr-4 text-xs font-bold text-[var(--ink)] outline-none"
              >
                <option value="earn">Best yield</option>
                <option value="borrow">Cheapest borrow</option>
                <option value="ltv">Highest LTV</option>
                <option value="depth">Deepest</option>
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setVenue(null)}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
              !venue ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)]" : "border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            All protocols
          </button>
          {venues.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVenue(venue === v ? null : v)}
              className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                venue === v ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)]" : "border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {v}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer select-none items-center gap-1.5 text-[11px] font-semibold text-[var(--ink-muted)]">
            <input type="checkbox" checked={showSmall} onChange={(e) => setShowSmall(e.target.checked)} className="accent-[var(--brand)]" />
            Show markets under $1K
          </label>
        </div>
      </div>

      {/* Stocks */}
      {loading && allGroups.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-8 text-center text-sm text-[var(--ink-muted)]">
          No verified markets match. Try another filter{showSmall ? "" : " or show markets under $1K"}.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {groups.map((g) => {
            const isOpen = open === g.symbol;
            const inCompare = compare.includes(g.symbol);
            return (
              <li key={g.address} className={`overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-xs transition ${isOpen ? "border-[var(--brand)]/40" : "border-[var(--border-subtle)]"}`}>
                <div className="flex items-center gap-3 p-3 sm:p-4">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : g.symbol)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                  >
                    <TokenLogo src={g.logo} address={g.address} symbol={g.symbol} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-[var(--ink)] sm:text-base">{g.symbol}</span>
                        <BadgeCheck size={14} className="shrink-0 text-[var(--brand-text)]" aria-label="On Base's official registry" />
                      </span>
                      <span className="block truncate text-[11px] text-[var(--ink-muted)]">{g.name}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {g.kinds.map((k) => (
                          <span key={k} className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${KIND_STYLE[k]}`}>{KIND_LABEL[k]}</span>
                        ))}
                      </span>
                    </span>
                    <span className="hidden min-w-[96px] text-right sm:block">
                      <span className="block text-[10px] font-semibold text-[var(--ink-muted)]">Best yield</span>
                      <span className="block font-mono text-base font-black text-emerald-600 dark:text-emerald-400">{pct(g.bestEarn?.supplyApy)}</span>
                      <span className="block truncate text-[10px] text-[var(--ink-dim)]">{g.bestEarn?.venue ?? "—"}</span>
                    </span>
                    <span className="hidden min-w-[96px] text-right md:block">
                      <span className="block text-[10px] font-semibold text-[var(--ink-muted)]">Borrow USDC</span>
                      <span className="block font-mono text-base font-black text-violet-600 dark:text-violet-400">{pct(g.bestBorrow?.borrowApr)}</span>
                      <span className="block text-[10px] text-[var(--ink-dim)]">{g.maxLtv ? `up to ${g.maxLtv.toFixed(0)}% LTV` : "—"}</span>
                    </span>
                    <span className="min-w-[72px] text-right">
                      <span className="block text-[10px] font-semibold text-[var(--ink-muted)]">Depth</span>
                      <span className="block font-mono text-sm font-black text-[var(--ink)]">{usd(g.totalDepthUsd)}</span>
                      <span className="block text-[10px] text-[var(--ink-dim)]">
                        {g.markets.length} {g.markets.length === 1 ? "market" : "markets"}
                      </span>
                    </span>
                    <ChevronDown size={16} className={`shrink-0 text-[var(--ink-dim)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <label className="flex shrink-0 cursor-pointer flex-col items-center gap-0.5 text-[9px] font-bold uppercase text-[var(--ink-muted)]" title="Compare up to 3 stocks">
                    <input
                      type="checkbox"
                      checked={inCompare}
                      disabled={!inCompare && compare.length >= 3}
                      onChange={() => toggleCompare(g.symbol)}
                      className="h-4 w-4 accent-[var(--brand)]"
                      aria-label={`Compare ${g.symbol}`}
                    />
                    Compare
                  </label>
                </div>

                {/* phone metrics */}
                <div className="grid grid-cols-2 gap-2 px-3 pb-3 sm:hidden">
                  <div className="rounded-xl bg-[var(--surface-2)] px-2.5 py-1.5">
                    <p className="text-[10px] text-[var(--ink-muted)]">Best yield</p>
                    <p className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">{pct(g.bestEarn?.supplyApy)}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-2)] px-2.5 py-1.5">
                    <p className="text-[10px] text-[var(--ink-muted)]">Borrow · max LTV</p>
                    <p className="font-mono text-sm font-black text-violet-600 dark:text-violet-400">
                      {pct(g.bestBorrow?.borrowApr)} {g.maxLtv ? <span className="text-[var(--ink-muted)]">· {g.maxLtv.toFixed(0)}%</span> : null}
                    </p>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="border-t border-[var(--border-subtle)]"
                    >
                      <StockDetail group={g} onAction={onAction} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}

      <VerificationNote />

      {/* Compare tray */}
      <AnimatePresence>
        {compare.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+86px)] z-40 mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]/95 p-2.5 shadow-2xl backdrop-blur-md md:bottom-6"
          >
            <Scale size={16} className="ml-1 shrink-0 text-[var(--brand-text)]" />
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto no-scrollbar">
              {compare.map((s) => (
                <span key={s} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-1 text-[11px] font-bold text-[var(--ink)]">
                  {s}
                  <button type="button" aria-label={`Remove ${s}`} onClick={() => toggleCompare(s)} className="cursor-pointer text-[var(--ink-dim)] hover:text-[var(--ink)]">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <button
              type="button"
              disabled={compare.length < 2}
              onClick={() => setCompareOpen(true)}
              className="shrink-0 cursor-pointer rounded-xl bg-[var(--brand)] px-3.5 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Compare {compare.length}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {compareOpen && compared.length >= 2 && (
          <ComparePanel groups={compared} onClose={() => setCompareOpen(false)} />
        )}
      </AnimatePresence>
    </section>
  );
}

// ─────────────────────────── expanded stock ───────────────────────────

function StockDetail({
  group,
  onAction,
}: {
  group: StockMarketGroup;
  onAction: (market: NormalizedMarket, action: "borrow" | "supply") => void;
}) {
  const [amount, setAmount] = useState("1000");
  const amt = parseFloat(amount) || 0;
  const earn = yearlyEarnings(amt, group.bestEarn?.supplyApy ?? 0);
  const cap = borrowCapacity(amt, group.maxLtv, group.bestBorrow?.borrowApr ?? 0);

  return (
    <div className="space-y-3 p-3 sm:p-4">
      {/* Markets */}
      <ul className="space-y-2">
        {group.markets.map((m) => (
          <MarketRow key={`${m.protocol}-${m.marketId}`} m={m} onAction={onAction} />
        ))}
      </ul>

      {/* Calculator */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
        <p className="flex items-center gap-1.5 text-xs font-black text-[var(--ink)]">
          <Calculator size={14} className="text-[var(--brand-text)]" /> What could {group.symbol} do for you?
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-[var(--ink-muted)]">With</span>
          <div className="relative w-32">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--ink-dim)]">$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              aria-label="Amount in dollars"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] py-1.5 pl-5 pr-2 font-mono text-xs text-[var(--ink)] outline-none focus:border-[var(--brand)]"
            />
          </div>
          <span className="text-xs text-[var(--ink-muted)]">of {group.symbol}</span>
        </div>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-[var(--surface)] p-2.5 text-xs">
            <p className="text-[var(--ink-muted)]">Earn per year (best yield)</p>
            <p className="font-mono text-lg font-black text-emerald-600 dark:text-emerald-400">{usd(earn)}</p>
            <p className="text-[10px] text-[var(--ink-dim)]">{group.bestEarn ? `${pct(group.bestEarn.supplyApy)} on ${group.bestEarn.venue}` : "No earning market"}</p>
          </div>
          <div className="rounded-xl bg-[var(--surface)] p-2.5 text-xs">
            <p className="text-[var(--ink-muted)]">Borrow USDC, comfortably</p>
            <p className="font-mono text-lg font-black text-violet-600 dark:text-violet-400">{cap.max ? usd(cap.safe) : "—"}</p>
            <p className="text-[10px] text-[var(--ink-dim)]">
              {cap.max ? `max ${usd(cap.max)} · ~${usd(cap.yearlyInterestOnSafe)}/yr interest` : "No borrow market"}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-[var(--ink-dim)]">Estimates from today&apos;s rates; rates change. Borrowing at half the max keeps a wide buffer before liquidation.</p>
      </div>
    </div>
  );
}

function MarketRow({ m, onAction }: { m: GroupMarket; onAction: (market: NormalizedMarket, action: "borrow" | "supply") => void }) {
  const small = marketDepthUsd(m) < 1000;
  const unreliable = isApyUnreliable(m);
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] p-2.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${KIND_STYLE[m.kind]}`}>{KIND_LABEL[m.kind]}</span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-bold text-[var(--ink)]">
            {m.venue} · {m.kind === "borrow" ? `${m.collateralAsset?.symbol} → USDC` : m.supplyAsset.symbol}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-[10px] text-[var(--ink-muted)]">
            <span>Depth {usd(marketDepthUsd(m))}</span>
            {m.kind === "borrow" && <span>Available {usd(m.liquidityUsd)}</span>}
            {small && (
              <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={10} /> small market
              </span>
            )}
            {unreliable && (
              <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={10} /> APY from a tiny pool
              </span>
            )}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          {m.kind === "borrow" ? (
            <>
              <p className="font-mono text-sm font-black text-violet-600 dark:text-violet-400">{pct(m.borrowApr)}</p>
              <p className="text-[10px] text-[var(--ink-muted)]">borrow · {m.maxLtv}% LTV</p>
            </>
          ) : (
            <>
              <p className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">{pct(m.supplyApy)}</p>
              <p className="text-[10px] text-[var(--ink-muted)]">APY</p>
            </>
          )}
        </div>
        {m.kind !== "lp" && m.canSupply !== false && (
          <button
            type="button"
            onClick={() => onAction(m, m.kind === "borrow" ? "borrow" : "supply")}
            className="cursor-pointer rounded-lg bg-[var(--brand)] px-3 py-1.5 text-[11px] font-black text-white transition hover:opacity-90"
          >
            {m.kind === "borrow" ? "Borrow" : "Deposit"}
          </button>
        )}
        <a
          href={m.sourceLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--ink-muted)] transition hover:border-[var(--brand)]/50 hover:text-[var(--ink)]"
        >
          {m.kind === "lp" ? `Open on ${m.venue}` : "Details"} <ExternalLink size={11} />
        </a>
      </div>
    </li>
  );
}

// ─────────────────────────── compare ───────────────────────────

function ComparePanel({ groups, onClose }: { groups: StockMarketGroup[]; onClose: () => void }) {
  const rows: Array<{ label: string; get: (g: StockMarketGroup) => number | null; fmt: (n: number | null) => string; better: "high" | "low" }> = [
    { label: "Best yield", get: (g) => g.bestEarn?.supplyApy ?? null, fmt: pct, better: "high" },
    { label: "Cheapest borrow", get: (g) => g.bestBorrow?.borrowApr ?? null, fmt: pct, better: "low" },
    { label: "Max LTV", get: (g) => (g.maxLtv ? g.maxLtv : null), fmt: (n) => (n == null ? "—" : `${n.toFixed(0)}%`), better: "high" },
    { label: "Total depth", get: (g) => g.totalDepthUsd, fmt: (n) => (n == null ? "—" : usd(n)), better: "high" },
    { label: "Markets", get: (g) => g.markets.length, fmt: (n) => (n == null ? "—" : String(n)), better: "high" },
    { label: "Protocols", get: (g) => g.venues.length, fmt: (n) => (n == null ? "—" : String(n)), better: "high" },
  ];
  return (
    <>
      <motion.div className="fixed inset-0 z-[80] bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Compare stocks"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="fixed inset-x-3 top-[10vh] z-[81] mx-auto max-h-[80vh] max-w-3xl overflow-y-auto rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-2xl sm:p-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-black text-[var(--ink)]">
            <Scale size={18} className="text-[var(--brand-text)]" /> Compare stocks
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer rounded-full p-1.5 text-[var(--ink-muted)] hover:bg-[var(--surface-2)]">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr>
                <th className="py-2 text-left text-[10px] font-bold uppercase text-[var(--ink-muted)]" />
                {groups.map((g) => (
                  <th key={g.symbol} className="py-2 text-center">
                    <span className="flex flex-col items-center gap-1">
                      <TokenLogo src={g.logo} address={g.address} symbol={g.symbol} size={30} />
                      <span className="text-xs font-black text-[var(--ink)]">{g.symbol}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {rows.map((r) => {
                const vals = groups.map(r.get);
                const nums = vals.filter((v): v is number => v != null);
                const best = nums.length ? (r.better === "high" ? Math.max(...nums) : Math.min(...nums)) : null;
                return (
                  <tr key={r.label}>
                    <td className="py-2.5 text-xs font-semibold text-[var(--ink-muted)]">{r.label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className="py-2.5 text-center">
                        <span
                          className={`rounded-lg px-2 py-0.5 font-mono text-sm font-black ${
                            v != null && v === best && nums.length > 1 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "text-[var(--ink)]"
                          }`}
                        >
                          {r.fmt(v)}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
              <tr>
                <td className="py-2.5 text-xs font-semibold text-[var(--ink-muted)]">Where</td>
                {groups.map((g) => (
                  <td key={g.symbol} className="py-2.5 text-center text-[11px] text-[var(--ink-muted)]">
                    {g.venues.join(" · ")}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-[var(--ink-dim)]">Green marks the best value in each row. Rates are live and change over time.</p>
      </motion.div>
    </>
  );
}

// ─────────────────────────── verification ───────────────────────────

function VerificationNote() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3.5">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full cursor-pointer items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 text-sm font-black text-[var(--ink)]">
          <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" /> Only verified markets, checked by contract address
        </span>
        <ChevronDown size={16} className={`text-[var(--ink-dim)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-2.5 space-y-1.5 text-xs text-[var(--ink-muted)]">
          <li>• <b className="text-[var(--ink)]">The stock</b> must be on Base&apos;s official registry (base.org/stocks), matched by its contract address, never by name.</li>
          <li>• <b className="text-[var(--ink)]">Morpho</b> borrow markets must be listed by Morpho with no warnings (unlisted markets and unusable oracles are hidden).</li>
          <li>• <b className="text-[var(--ink)]">Beefy</b> vaults (including Aave v4 lending vaults) must be active and hold the official stock contract, per Beefy&apos;s own token list.</li>
          <li>• <b className="text-[var(--ink)]">Aerodrome</b> pools must contain the official stock contract, per DefiLlama&apos;s pool data.</li>
          <li>• Tokens that share a ticker (e.g. VVV, CAKE, COMP) or wrapped look-alikes are excluded. Liquidity pools open on the protocol&apos;s own site.</li>
        </ul>
      )}
    </div>
  );
}
