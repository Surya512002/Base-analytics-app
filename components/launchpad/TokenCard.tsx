"use client";

import Link from "next/link";
import { ArrowUpRight, Rocket, Shield, Star, TrendingDown, TrendingUp, User } from "lucide-react";
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
      className="group cursor-pointer rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden hover:border-[var(--border-strong)] transition-all"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {onToggleWatch && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWatch();
              }}
              className="shrink-0 mt-1 p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
            >
              <Star
                size={16}
                className={watched ? "text-amber-400 fill-amber-400" : "text-slate-600"}
              />
            </button>
          )}
          {token.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={token.imageUrl}
              alt=""
              className="w-12 h-12 rounded-xl object-cover border border-white/10 group-hover:border-[var(--border-strong)]"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-sm font-black text-[var(--ink-muted)]">
              {token.symbol.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-white truncate group-hover:text-[var(--ink)] transition-colors">
                {token.name}
              </h3>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${tokenBadgeClass(token)}`}
              >
                {tokenBadgeLabel(token)}
              </span>
              {isMine && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  Yours
                </span>
              )}
              {hasPool && change != null && (
                <span
                  className={`inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                    change >= 0
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {change >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                  {Math.abs(change).toFixed(1)}%
                </span>
              )}
              <span
                className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                  safety === "pooled"
                    ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                    : safety === "low"
                      ? "border-amber-500/30 text-amber-200 bg-amber-500/10"
                      : safety === "new"
                        ? "border-[var(--border-subtle)] text-[var(--ink-muted)] bg-[var(--bg-elevated)]"
                        : "border-white/10 text-slate-500"
                }`}
              >
                <Shield size={8} />
                {safetyLabel}
              </span>
            </div>
            <p className="text-sm font-bold text-[var(--ink-muted)]">${token.symbol}</p>
            <p className="text-[10px] text-slate-500 font-mono mt-1">
              {shortAddr(token.address)}
            </p>
          </div>
        </div>

        {token.description ? (
          <p className="text-[11px] text-slate-500 mt-3 line-clamp-2 min-h-8">
            {token.description}
          </p>
        ) : (
          <p className="text-[11px] text-slate-600 mt-3 italic min-h-8">
            {isAppLaunched(token)
              ? "B20 on Base · Uniswap + Aerodrome"
              : "Trade on Base · Uniswap + Aerodrome"}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
          <div className="rounded-lg bg-white/[0.03] border border-white/8 px-2 py-1.5">
            <p className="text-slate-500">MCap</p>
            <p className="font-bold text-white font-mono">
              {market?.marketCap ? formatUsd(market.marketCap) : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/8 px-2 py-1.5">
            <p className="text-slate-500">Vol 24h</p>
            <p className="font-bold text-white font-mono">
              {market?.volume24h ? formatUsd(market.volume24h) : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/8 px-2 py-1.5">
            <p className="text-slate-500">Liq</p>
            <p className="font-bold text-white font-mono">
              {market?.liquidityUsd ? formatUsd(market.liquidityUsd) : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/8 gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500">
              {isAppLaunched(token) ? createdAgo(token.createdAt) : "External · DexScreener"}
            </p>
            {holdingBalance != null && holdingBalance > 0 && (
              <p className="text-[10px] font-bold text-emerald-300 mt-0.5">
                You hold {holdingBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
                {token.symbol}
              </p>
            )}
            {token.creator && (
              <Link
                href={`/creator/${token.creator}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[10px] text-[var(--ink)] hover:text-white mt-1"
              >
                <User size={10} />
                Creator
              </Link>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-black text-white bg-[var(--accent)] group-hover:bg-[var(--accent-hover)] px-3 py-1.5 rounded-lg transition-colors">
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
      className="h-full min-h-[220px] rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] hover:border-[var(--border-strong)] transition-all flex flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <div className="w-14 h-14 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
        <Rocket size={24} className="text-[var(--ink-muted)]" />
      </div>
      <div>
        <p className="font-black text-white text-lg">Launch on Base</p>
        <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
          $0 launch · vanity 0xB200… · vesting · anti-snipe · dual DEX
        </p>
      </div>
    </button>
  );
}
