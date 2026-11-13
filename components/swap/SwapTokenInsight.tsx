"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, History, LineChart, X } from "lucide-react";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { formatCompactUsd, formatExactUsd } from "@/lib/explore/explore-config";
import { BuySellBar } from "@/components/explore/LiveMarketMap";
import TokenLogo from "@/components/ui/TokenLogo";

/** Market snapshot for one token (DexScreener via our batch route). */
function useTokenMarket(address: string | null) {
  const [state, setState] = useState<{ for: string; market: TokenMarketSummary | null } | null>(null);
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetch("/api/launchpad/market/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses: [address] }),
    })
      .then((r) => (r.ok ? r.json() : { markets: {} }))
      .then((j: { markets?: Record<string, TokenMarketSummary> }) => {
        if (!cancelled) setState({ for: address, market: j.markets?.[address] ?? null });
      })
      .catch(() => !cancelled && setState({ for: address, market: null }));
    return () => {
      cancelled = true;
    };
  }, [address]);
  if (!address) return { market: null, loading: false };
  return { market: state?.for === address ? state.market : null, loading: state?.for !== address };
}

/**
 * Before you buy: price, 24h move, liquidity, volume, market cap and the buy/sell split of the
 * token you're about to receive, with plain warnings for thin liquidity or unverified tokens.
 */
export default function SwapTokenInsight({ token }: { token: SwapCounter | null }) {
  const address = token?.kind === "token" ? token.address.toLowerCase() : null;
  const { market, loading } = useTokenMarket(address);
  if (!token || token.kind !== "token") return null;

  const ch = market?.priceChange24h ?? null;
  const liq = market?.liquidityUsd ?? null;
  const thin = liq != null && liq < 10_000;
  const unverified = token.isUnverified || token.isVerified === false;

  const stat = (label: string, value: React.ReactNode) => (
    <div className="rounded-xl bg-[var(--surface-2)] px-2.5 py-2">
      <p className="text-[10px] font-semibold text-[var(--ink-muted)]">{label}</p>
      <p className="font-mono text-xs font-black tabular-nums text-[var(--ink)]">{value}</p>
    </div>
  );

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="flex items-center gap-2.5">
        <TokenLogo src={token.imageUrl} address={token.address} symbol={token.symbol} size={32} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-black text-[var(--ink)]">
            <span className="truncate">{token.symbol}</span>
            {token.isVerified && <BadgeCheck size={14} className="shrink-0 text-[var(--brand-text)]" aria-label="Verified" />}
          </p>
          <p className="truncate text-[11px] text-[var(--ink-muted)]">{token.name ?? "Token"} · what you&apos;re buying</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-black tabular-nums text-[var(--ink)]">
            {market?.priceUsd ? formatExactUsd(market.priceUsd) : loading ? "…" : "—"}
          </p>
          {ch != null && (
            <p className={`font-mono text-[11px] font-bold ${ch >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {ch >= 0 ? "+" : ""}
              {ch.toFixed(2)}% 24h
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stat("Liquidity", liq != null ? formatCompactUsd(liq) : "—")}
        {stat("24h volume", market?.volume24h != null ? formatCompactUsd(market.volume24h) : "—")}
        {stat("Market cap", market?.marketCap ? formatCompactUsd(market.marketCap) : "—")}
      </div>

      {(market?.buys24h || market?.sells24h) ? (
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-[var(--ink-muted)]">
            <LineChart size={11} /> 24h buys vs sells
          </p>
          <BuySellBar buys={market?.buys24h ?? 0} sells={market?.sells24h ?? 0} showCounts />
        </div>
      ) : null}

      {(thin || unverified) && (
        <ul className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
          {thin && (
            <li className="flex items-start gap-1.5">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> Thin liquidity ({formatCompactUsd(liq!)}): bigger trades move the price a lot.
            </li>
          )}
          {unverified && (
            <li className="flex items-start gap-1.5">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> Not a verified token. Check the contract before buying.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

// ─────────────────────────── recent tokens ───────────────────────────

const RECENT_KEY = "base_swap_recent_tokens_v1";
const MAX_RECENT = 6;

type RecentToken = { address: string; symbol: string; decimals: number; imageUrl?: string; name?: string };

function readRecent(): RecentToken[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as RecentToken[]) : [];
    return Array.isArray(list) ? list.filter((t) => /^0x[a-fA-F0-9]{40}$/.test(t?.address ?? "")).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/**
 * Tokens you picked recently (kept in this browser only), one tap to pick again.
 * Remembers the current buy token whenever it changes.
 */
export function RecentSwapTokens({
  current,
  onSelect,
}: {
  current: SwapCounter | null;
  onSelect: (counter: SwapCounter) => void;
}) {
  const [recent, setRecent] = useState<RecentToken[]>([]);

  useEffect(() => {
    const list = readRecent();
    if (current?.kind === "token") {
      const entry: RecentToken = {
        address: current.address.toLowerCase(),
        symbol: current.symbol,
        decimals: current.decimals,
        imageUrl: current.imageUrl,
        name: current.name,
      };
      const next = [entry, ...list.filter((t) => t.address !== entry.address)].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked */
      }
      setRecent(next);
    } else {
      setRecent(list);
    }
  }, [current]);

  const others = recent.filter((t) => !(current?.kind === "token" && current.address.toLowerCase() === t.address));
  if (others.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[var(--ink-muted)]">
        <History size={12} /> Recent
      </span>
      {others.map((t) => (
        <span key={t.address} className="group inline-flex shrink-0 items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface)]">
          <button
            type="button"
            onClick={() => onSelect({ kind: "token", address: t.address, symbol: t.symbol, decimals: t.decimals, imageUrl: t.imageUrl, name: t.name })}
            className="inline-flex cursor-pointer items-center gap-1 py-1 pl-1.5 pr-1 text-[11px] font-bold text-[var(--ink)]"
          >
            <TokenLogo src={t.imageUrl} address={t.address} symbol={t.symbol} size={16} />
            {t.symbol}
          </button>
          <button
            type="button"
            aria-label={`Forget ${t.symbol}`}
            onClick={() => {
              const next = recent.filter((r) => r.address !== t.address);
              try {
                localStorage.setItem(RECENT_KEY, JSON.stringify(next));
              } catch {
                /* storage blocked */
              }
              setRecent(next);
            }}
            className="cursor-pointer pr-1.5 text-[var(--ink-dim)] hover:text-[var(--ink)]"
          >
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}
