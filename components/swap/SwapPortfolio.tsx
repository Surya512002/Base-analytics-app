"use client";

import React, { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, PieChart, RefreshCw, Wallet } from "lucide-react";
import type { PortfolioToken } from "@/lib/portfolio/types";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import TokenLogo from "@/components/ui/TokenLogo";

const BAR_COLORS = ["#3D7BFF", "#82ACFF", "#1D62F0", "#d8b565", "#10B981", "#F59E0B"];

const usd = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Your token holdings, inside Swap: total value, 24h change, an allocation bar, and every
 * token with one-tap Sell (sets it as what you pay) or Buy more (sets it as what you get).
 */
export default function SwapPortfolio({
  tokens,
  totalUsd,
  loading,
  connected,
  onConnect,
  onSell,
  onBuy,
  onOpenAll,
  onRefresh,
}: {
  tokens: PortfolioToken[];
  totalUsd: number;
  loading: boolean;
  connected: boolean;
  onConnect?: () => void;
  onSell: (counter: SwapCounter) => void;
  onBuy: (counter: SwapCounter) => void;
  onOpenAll: () => void;
  onRefresh?: () => void;
}) {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  const held = useMemo(
    () => tokens.filter((t) => !t.isSpam && t.balanceNumber > 0).sort((a, b) => b.usdValue - a.usdValue),
    [tokens]
  );
  // 24h change of the whole portfolio, weighted by value (priced tokens with a change only).
  const change = useMemo(() => {
    let now = 0;
    let before = 0;
    for (const t of held) {
      if (t.priceChange24h == null || t.usdValue <= 0) continue;
      now += t.usdValue;
      before += t.usdValue / (1 + t.priceChange24h / 100);
    }
    return before > 0 ? ((now - before) / before) * 100 : null;
  }, [held]);

  const priced = held.filter((t) => t.usdValue > 0);
  const top = priced.slice(0, 5);
  const otherUsd = priced.slice(5).reduce((s, t) => s + t.usdValue, 0);
  const shown = expanded ? held : held.slice(0, 5);

  if (!connected) {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-5 text-center">
        <Wallet size={22} className="mx-auto text-[var(--brand-text)]" />
        <p className="mt-2 text-sm font-black text-[var(--ink)]">See your tokens here</p>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">Connect a wallet to swap straight from your holdings.</p>
        {onConnect && (
          <button
            type="button"
            onClick={onConnect}
            className="mt-3 inline-flex min-h-[40px] cursor-pointer items-center rounded-full bg-[var(--brand)] px-5 text-xs font-black text-white"
          >
            Connect wallet
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-2.5 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-black text-[var(--ink)]">
            <PieChart size={15} className="text-[var(--brand-text)]" /> Your portfolio
          </h3>
          <p className="mt-0.5 font-mono text-lg font-black tabular-nums text-[var(--ink)]">
            {loading && held.length === 0 ? "…" : usd(totalUsd)}
          </p>
          <p className="text-[11px] text-[var(--ink-muted)]">
            {held.length} {held.length === 1 ? "token" : "tokens"} on Base
            {change != null && (
              <span className={`ml-1.5 font-bold ${change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}% 24h
              </span>
            )}
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh holdings"
            className="cursor-pointer rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] p-2 text-[var(--ink-muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {/* Allocation */}
      {totalUsd > 0 && top.length > 0 && (
        <div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
            {top.map((t, i) => (
              <motion.span
                key={t.counter.kind === "token" ? t.counter.address : "eth"}
                title={`${t.symbol} ${((t.usdValue / totalUsd) * 100).toFixed(1)}%`}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${(t.usdValue / totalUsd) * 100}%` }}
                transition={{ duration: 0.6, delay: i * 0.05 }}
                style={{ background: BAR_COLORS[i] }}
              />
            ))}
            {otherUsd > 0 && <span style={{ width: `${(otherUsd / totalUsd) * 100}%`, background: "var(--ink-dim)" }} />}
          </div>
        </div>
      )}

      {/* Holdings */}
      {held.length === 0 ? (
        <p className="py-4 text-center text-xs text-[var(--ink-muted)]">
          {loading ? "Loading your tokens…" : "No tokens on Base yet. Buy your first one above."}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]/70">
          {shown.map((t) => {
            const ch = t.priceChange24h;
            return (
              <li key={t.counter.kind === "token" ? t.counter.address : "eth"} className="flex items-center gap-2 py-1.5">
                <TokenLogo src={t.logo ?? undefined} address={t.address ?? undefined} symbol={t.symbol} size={26} />
                <div className="min-w-0 flex-1" title={`${t.balanceFormatted} ${t.symbol}`}>
                  <p className="truncate text-[13px] font-bold text-[var(--ink)]">{t.symbol}</p>
                  <p className="truncate font-mono text-[11px] tabular-nums text-[var(--ink-muted)]">
                    {t.usdValue > 0 ? usd(t.usdValue) : "—"}
                    {ch != null && (
                      <span className={`ml-1 font-bold ${ch >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {ch >= 0 ? "+" : ""}
                        {ch.toFixed(1)}%
                      </span>
                    )}
                  </p>
                </div>
                {t.hasTradeRoute && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onSell(t.counter)}
                      title={`Sell ${t.symbol}`}
                      aria-label={`Sell ${t.symbol}`}
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] transition hover:border-red-500/40 hover:text-red-600"
                    >
                      <ArrowUpRight size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onBuy(t.counter)}
                      title={`Buy more ${t.symbol}`}
                      aria-label={`Buy more ${t.symbol}`}
                      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] transition hover:border-emerald-500/40 hover:text-emerald-600"
                    >
                      <ArrowDownLeft size={14} aria-hidden />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        {held.length > 5 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[var(--border-subtle)] py-2 text-xs font-bold text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
          >
            {expanded ? "Show less" : `Show all ${held.length}`}
            <ChevronDown size={13} className={expanded ? "rotate-180" : ""} />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenAll}
          className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-[var(--border-subtle)] py-2 text-xs font-bold text-[var(--brand-text)] transition hover:border-[var(--brand)]/50"
        >
          Manage holdings
        </button>
      </div>
    </section>
  );
}
