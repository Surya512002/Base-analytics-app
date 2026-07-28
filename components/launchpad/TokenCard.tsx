"use client";

import Link from "next/link";
import { ArrowUpRight, Rocket, Shield, Star, TrendingDown, TrendingUp } from "lucide-react";
import CreatorChip from "@/components/launchpad/CreatorChip";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import { createdAgo, formatUsd, shortAddr } from "@/lib/launchpad/format";
import { isAppLaunched, tokenBadgeClass, tokenBadgeLabel } from "@/lib/launchpad/token-meta";
import {
  tokenSafetyLabel,
  tokenSafetyLevel,
} from "@/lib/launchpad/explore-rankings";

export default function TokenCard({
  token,
  market,
  onTrade,
  isMine,
  watched,
  onToggleWatch,
  holdingBalance,
}: {
  token: LaunchedToken;
  market?: TokenMarketSummary;
  onTrade: () => void;
  isMine?: boolean;
  watched?: boolean;
  onToggleWatch?: () => void;
  holdingBalance?: number;
}) {
  const change = market?.priceChange24h;
  const hasPool = market?.hasPool;
  const safety = tokenSafetyLevel(market);
  const safetyLabel = tokenSafetyLabel(safety);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onTrade}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onTrade();
      }}
      className="token-card group cursor-pointer rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] overflow-hidden shadow-[var(--shadow-card)] transition-all hover:border-[var(--brand)] hover:shadow-[0_12px_32px_rgba(26,92,255,0.12)]"
    >
      <div className="p-4 sm:p-4.5">
        <div className="flex items-start gap-3.5">
          {onToggleWatch && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWatch();
              }}
              className="shrink-0 mt-2 p-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
              aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
            >
              <Star
                size={16}
                className={watched ? "text-amber-500 fill-amber-500" : "text-[var(--ink-dim)]"}
              />
            </button>
          )}

          <div className="token-card-avatar shrink-0">
            {token.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={token.imageUrl}
                alt=""
                className="h-16 w-16 rounded-2xl object-cover border-2 border-[var(--border-subtle)] bg-[var(--surface-2)] group-hover:border-[var(--brand)] transition-colors sm:h-[4.5rem] sm:w-[4.5rem]"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--brand-soft)] text-lg font-black text-[var(--brand-dark)] sm:h-[4.5rem] sm:w-[4.5rem] sm:text-xl">
                {token.symbol.slice(0, 2)}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="max-w-full truncate text-base font-bold text-[var(--ink)] sm:text-[17px]">
                {token.name}
              </h3>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${tokenBadgeClass(token)}`}
              >
                {tokenBadgeLabel(token)}
              </span>
              {isMine && (
                <span className="shrink-0 rounded-full border border-emerald-500/35 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                  Yours
                </span>
              )}
              {hasPool && change != null && (
                <span
                  className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    change >= 0
                      ? "bg-emerald-500/12 text-emerald-700"
                      : "bg-rose-500/12 text-rose-700"
                  }`}
                >
                  {change >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                  {Math.abs(change).toFixed(1)}%
                </span>
              )}
              <span
                className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${
                  safety === "pooled"
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700"
                    : safety === "low"
                      ? "border-amber-500/35 bg-amber-500/10 text-amber-800"
                      : safety === "new"
                        ? "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-dim)]"
                }`}
              >
                <Shield size={8} />
                {safetyLabel}
              </span>
            </div>
            <p className="mt-0.5 text-sm font-bold text-[var(--brand-dark)]">${token.symbol}</p>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--ink-dim)]">
              {shortAddr(token.address)}
            </p>
          </div>
        </div>

        {token.description ? (
          <p className="mt-3 line-clamp-2 min-h-8 text-[12px] leading-relaxed text-[var(--ink-muted)]">
            {token.description}
          </p>
        ) : (
          <p className="mt-3 min-h-8 text-[12px] italic text-[var(--ink-dim)]">
            {isAppLaunched(token)
              ? "B20 on Base · Uniswap + Aerodrome"
              : "Trade on Base · Uniswap + Aerodrome"}
          </p>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
          {(
            [
              { label: "MCap", value: market?.marketCap ? formatUsd(market.marketCap) : "—" },
              { label: "Vol 24h", value: market?.volume24h ? formatUsd(market.volume24h) : "—" },
              { label: "Liq", value: market?.liquidityUsd ? formatUsd(market.liquidityUsd) : "—" },
            ] as const
          ).map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 py-2"
            >
              <p className="font-semibold uppercase tracking-wide text-[var(--ink-dim)]">
                {stat.label}
              </p>
              <p className="mt-0.5 truncate font-bold font-mono text-[13px] text-[var(--ink)]">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-[var(--ink-muted)]">
              {isAppLaunched(token) ? createdAgo(token.createdAt) : "External · DexScreener"}
            </p>
            {holdingBalance != null && holdingBalance > 0 && (
              <p className="mt-0.5 text-[10px] font-bold text-emerald-700">
                You hold {holdingBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
                {token.symbol}
              </p>
            )}
            {token.creator && (
              <CreatorChip
                address={token.creator}
                size="xs"
                className="mt-1 px-0 py-0 hover:bg-transparent"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--brand)] px-3 py-2 text-[11px] font-bold text-white transition-colors group-hover:bg-[var(--brand-dark)]">
            Trade <ArrowUpRight size={12} />
          </span>
        </div>
      </div>
    </article>
  );
}

export function CreateTokenCard({ onCreate }: { onCreate: () => void }) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)] p-6 text-center transition-all hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]/40"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <Rocket size={28} className="text-[var(--brand)]" />
      </div>
      <div>
        <p className="text-lg font-bold text-[var(--ink)]">Launch on Base</p>
        <p className="mx-auto mt-1 max-w-[220px] text-[11px] leading-relaxed text-[var(--ink-muted)]">
          $0 launch · vanity 0xB200… · vesting · anti-snipe · dual DEX
        </p>
      </div>
    </button>
  );
}
