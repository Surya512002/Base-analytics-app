"use client";

/**
 * "Just launched on Base Analytics": tokens created through the app's launchpad, newest first,
 * shown as a spotlight under Market Signals. The newest launch gets the featured gradient card;
 * the rest scroll sideways. Uses tokens + markets the Explore page already loaded (no new
 * requests); the "x min ago" labels tick once a minute.
 */
import { useMemo } from "react";
import { ArrowUpRight, Rocket, Sparkles } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import { buildRecentlyAppLaunched } from "@/lib/launchpad/explore-rankings";
import { tokenBadgeLabel } from "@/lib/launchpad/token-meta";
import { formatCompact, formatSubscriptPrice } from "@/lib/launchpad/format";
import { useNow } from "@/hooks/useLiveTrades";
import TokenLogo from "@/components/ui/TokenLogo";

type Item = { launched: LaunchedToken; unified: UnifiedToken | undefined };

function ago(createdAtMs: number, now: number): string {
  const s = Math.max(0, Math.floor((now - createdAtMs) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Change({ value }: { value: number | undefined }) {
  if (value == null || !Number.isFinite(value) || value === 0) return null;
  const up = value > 0;
  return (
    <span className={`font-mono text-xs font-bold tabular-nums ${up ? "text-[var(--success-text)]" : "text-[var(--danger-text)]"}`}>
      {up ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

export default function LaunchSpotlightStrip({
  tokens,
  unifiedByAddress,
  onOpen,
  onTrade,
  onLaunch,
}: {
  tokens: LaunchedToken[];
  unifiedByAddress: Map<string, UnifiedToken>;
  onOpen: (t: UnifiedToken) => void;
  onTrade: (t: UnifiedToken) => void;
  onLaunch?: () => void;
}) {
  const now = useNow(60_000);
  const items: Item[] = useMemo(
    () =>
      buildRecentlyAppLaunched(tokens, 10).map((launched) => ({
        launched,
        unified: unifiedByAddress.get(launched.address.toLowerCase()),
      })),
    [tokens, unifiedByAddress]
  );

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="pulse-eyebrow">
          <span className="pulse-status-dot" aria-hidden />
          Just launched on Base Analytics
        </p>
        <h2 className="mt-1.5 text-xl font-black tracking-tight text-[var(--ink)] sm:text-2xl">Launch spotlight</h2>
      </div>
      {onLaunch && (
        <button
          type="button"
          onClick={onLaunch}
          className="pulse-chip min-h-9 cursor-pointer px-3.5 py-1.5 text-sm transition hover:brightness-110"
        >
          <Rocket size={14} aria-hidden /> Launch yours
        </button>
      )}
    </div>
  );

  if (items.length === 0) {
    return (
      <section aria-label="Launch spotlight" className="pulse-card space-y-4 p-4 sm:p-5">
        {header}
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center">
          <Sparkles size={18} className="text-[var(--brand-text)]" aria-hidden />
          <p className="text-sm font-bold text-[var(--ink)]">No launches yet. Be the first.</p>
          <p className="max-w-sm text-xs text-[var(--ink-muted)]">Tokens launched here appear in this spotlight the moment they go live.</p>
        </div>
      </section>
    );
  }

  const [featured, ...rest] = items;
  const open = (it: Item) => it.unified && onOpen(it.unified);
  const trade = (it: Item) => it.unified && onTrade(it.unified);

  return (
    <section aria-label="Launch spotlight" className="pulse-card space-y-4 p-4 sm:p-5">
      {header}

      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar touch-scroll-x snap-x snap-mandatory">
        {/* Newest launch: the spotlight */}
        <article className="pulse-surface flex w-[85%] shrink-0 snap-start flex-col justify-between gap-4 p-4 sm:w-[340px] sm:p-5">
          <button type="button" onClick={() => open(featured)} className="flex items-center gap-3 text-left" aria-label={`Open ${featured.launched.symbol}`}>
            <span className="shrink-0 rounded-2xl bg-white/15 p-1 ring-1 ring-white/25">
              <TokenLogo address={featured.launched.address} symbol={featured.launched.symbol} src={featured.launched.imageUrl} size={44} shape="rounded-xl" />
            </span>
            <span className="min-w-0">
              <span className="pulse-eyebrow text-[10px]">Newest · {ago(featured.launched.createdAt, now)}</span>
              <span className="block truncate text-2xl font-black tracking-tight text-white">${featured.launched.symbol}</span>
              <span className="block truncate text-xs text-[var(--ink-muted)]">{featured.launched.name}</span>
            </span>
          </button>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="pulse-big text-2xl">
                {featured.unified?.priceUsd ? formatSubscriptPrice(featured.unified.priceUsd) : "New"}
              </p>
              <p className="mt-1 flex items-center gap-2 text-[11px] text-[var(--ink-dim)]">
                {featured.unified?.marketCapUsd ? <span>MC ${formatCompact(featured.unified.marketCapUsd)}</span> : <span>Pool opening</span>}
                <Change value={featured.unified?.priceChange24h} />
              </p>
            </div>
            <div className="flex items-center gap-2">
              {tokenBadgeLabel(featured.launched) && <span className="pulse-chip text-[10px]">{tokenBadgeLabel(featured.launched)}</span>}
              {featured.unified && (
                <button
                  type="button"
                  onClick={() => trade(featured)}
                  className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full bg-white px-4 text-xs font-black text-[#0041cc] shadow-lg shadow-black/15 transition hover:bg-white/90"
                >
                  Trade <ArrowUpRight size={13} aria-hidden />
                </button>
              )}
            </div>
          </div>
        </article>

        {/* The next launches */}
        {rest.map((it) => (
          <article
            key={it.launched.address}
            className="flex w-[70%] shrink-0 snap-start flex-col justify-between gap-3 rounded-[1.25rem] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3.5 transition hover:border-[var(--pill-border)] sm:w-[220px]"
          >
            <button type="button" onClick={() => open(it)} className="flex items-center gap-2.5 text-left" aria-label={`Open ${it.launched.symbol}`}>
              <TokenLogo address={it.launched.address} symbol={it.launched.symbol} src={it.launched.imageUrl} size={36} shape="rounded-xl" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-[var(--ink)]">${it.launched.symbol}</span>
                <span className="block truncate text-[11px] text-[var(--ink-dim)]">{ago(it.launched.createdAt, now)}</span>
              </span>
            </button>
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-black tabular-nums text-[var(--ink)]">
                  {it.unified?.priceUsd ? formatSubscriptPrice(it.unified.priceUsd) : "New"}
                </p>
                <Change value={it.unified?.priceChange24h} />
              </div>
              {it.unified && (
                <button
                  type="button"
                  onClick={() => trade(it)}
                  className="pulse-chip min-h-8 shrink-0 cursor-pointer px-3 text-[11px] transition hover:brightness-110"
                  aria-label={`Trade ${it.launched.symbol}`}
                >
                  Trade
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
