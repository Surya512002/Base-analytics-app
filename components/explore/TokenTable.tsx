"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  MoreHorizontal,
  ExternalLink,
  Copy,
  Check,
  Star,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import {
  formatCompactUsd,
  formatExactUsd,
  isLowLiquidity,
  isExtremeMove,
  isNewToken,
} from "@/lib/explore/explore-config";
import TokenCard from "./TokenCard";
import { shortAddr } from "@/lib/launchpad/format";
import TokenAvatar from "@/components/ui/TokenAvatar";

interface TokenTableProps {
  tokens: UnifiedToken[];
  onSelectToken: (token: UnifiedToken) => void;
  onTradeToken: (token: UnifiedToken) => void;
  onToggleWatch: (token: UnifiedToken) => void;
  watchlist?: string[];
  viewMode?: "table" | "grid";
}

export default function TokenTable({
  tokens,
  onSelectToken,
  onTradeToken,
  onToggleWatch,
  watchlist = [],
  viewMode = "table",
}: TokenTableProps) {
  const [activeMenuTokenId, setActiveMenuTokenId] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const handleCopy = (address: string, tokenId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedTokenId(tokenId);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  // If grid mode is chosen, render responsive grid using TokenCard
  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {tokens.map((token) => (
          <TokenCard
            key={token.id}
            token={token}
            onTrade={onTradeToken}
            onSelect={onSelectToken}
            onToggleWatch={onToggleWatch}
            isWatched={watchlist.includes(token.address.toLowerCase())}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)] sticky top-0 z-10 backdrop-blur-md">
              <th className="py-3 px-3.5 w-10">#</th>
              <th className="py-3 px-3.5">Token</th>
              <th className="py-3 px-3.5 text-right">Price</th>
              <th className="py-3 px-3.5 text-right">24h %</th>
              <th className="py-3 px-3.5 text-right">24h Volume</th>
              <th className="py-3 px-3.5 text-right">Liquidity</th>
              <th className="py-3 px-3.5 text-right">Market Cap</th>
              <th className="py-3 px-3.5 text-center">Status</th>
              <th className="py-3 px-3 w-10 text-center">Watch</th>
              <th className="py-3 px-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]/60 text-xs">
            {tokens.map((token, index) => {
              const isUp = token.priceChange24h >= 0;
              const isZero = token.priceChange24h === 0;
              const isWatched = watchlist.includes(token.address.toLowerCase());
              const isMenuOpen = activeMenuTokenId === token.id;
              const isCopied = copiedTokenId === token.id;

              // Type badge
              const typeBadge =
                token.type === "b20"
                  ? { label: "B20", class: "bg-[#0052FF]/10 text-[#0052FF]" }
                  : token.type === "stock"
                    ? { label: "Stock", class: "bg-blue-500/10 text-blue-600 dark:text-blue-400" }
                    : { label: "Base", class: "bg-[var(--surface-2)] text-[var(--ink-muted)]" };

              // Pool / Risk status
              let statusLabel = "Pooled";
              let statusClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
              let statusTooltip = "Has an active liquidity pool on Base DEX.";

              if (!token.hasPool) {
                statusLabel = "No Pool";
                statusClass = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25";
                statusTooltip = "No active liquidity pool detected on DEX.";
              } else if (isLowLiquidity(token)) {
                statusLabel = "Low Liq";
                statusClass = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25";
                statusTooltip = `Liquidity is below $10,000 (${formatCompactUsd(token.liquidityUsd)}).`;
              } else if (isExtremeMove(token)) {
                statusLabel = "Volatile";
                statusClass = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25";
                statusTooltip = `24h move exceeds ±50% (${token.priceChange24h.toFixed(1)}%).`;
              }

              return (
                <tr
                  key={token.id}
                  onClick={() => onSelectToken(token)}
                  className="pop-row group transition cursor-pointer"
                >
                  {/* Rank */}
                  <td className="py-3 px-3.5 font-mono text-[var(--ink-dim)] text-[11px]">
                    {index + 1}
                  </td>

                  {/* Token Identity */}
                  <td className="py-3 px-3.5">
                    <div className="flex items-center gap-2.5">
                      <TokenAvatar
                        src={token.imageUrl}
                        address={token.address}
                        symbol={token.symbol}
                        className="w-8 h-8 rounded-xl"
                        textClassName="text-[10px]"
                      />

                      <div className="min-w-0 max-w-[170px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-[var(--ink)] truncate group-hover:text-[#0052FF] transition-colors">
                            {token.name}
                          </span>
                          <span
                            className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${typeBadge.class}`}
                          >
                            {typeBadge.label}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-[var(--ink-muted)] truncate">
                          ${token.symbol}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-3 px-3.5 text-right font-mono font-bold text-[var(--ink)] tabular-nums">
                    {formatExactUsd(token.priceUsd)}
                  </td>

                  {/* 24h Change */}
                  <td className="py-3 px-3.5 text-right">
                    <span
                      className={`inline-flex items-center justify-end gap-0.5 font-mono font-bold tabular-nums ${
                        isZero
                          ? "text-[var(--ink-muted)]"
                          : isUp
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isUp && !isZero ? (
                        <TrendingUp size={12} />
                      ) : !isZero ? (
                        <TrendingDown size={12} />
                      ) : null}
                      <span>
                        {isUp && !isZero ? "+" : ""}
                        {token.priceChange24h.toFixed(1)}%
                      </span>
                    </span>
                  </td>

                  {/* 24h Volume */}
                  <td
                    className="py-3 px-3.5 text-right font-mono text-[var(--ink)] tabular-nums"
                    title={`Exact 24h Volume: ${formatExactUsd(token.volume24h)}`}
                  >
                    {formatCompactUsd(token.volume24h)}
                  </td>

                  {/* Liquidity */}
                  <td
                    className="py-3 px-3.5 text-right font-mono text-[var(--ink)] tabular-nums"
                    title={`Exact Liquidity: ${formatExactUsd(token.liquidityUsd)}`}
                  >
                    {formatCompactUsd(token.liquidityUsd)}
                  </td>

                  {/* Market Cap */}
                  <td
                    className="py-3 px-3.5 text-right font-mono text-[var(--ink)] tabular-nums"
                    title={`Exact Market Cap: ${formatExactUsd(token.marketCapUsd)}`}
                  >
                    {formatCompactUsd(token.marketCapUsd)}
                  </td>

                  {/* Pool Status Badge with Tooltip */}
                  <td className="py-3 px-3.5 text-center">
                    <span
                      title={statusTooltip}
                      className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${statusClass}`}
                    >
                      {statusLabel !== "Pooled" && <ShieldAlert size={10} />}
                      <span>{statusLabel}</span>
                    </span>
                  </td>

                  {/* Watch Star */}
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatch(token);
                      }}
                      className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-amber-500 hover:bg-[var(--surface-2)] transition cursor-pointer"
                      title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      <Star
                        size={14}
                        className={isWatched ? "fill-amber-500 text-amber-500" : ""}
                      />
                    </button>
                  </td>

                  {/* Actions: Swap Button + ⋯ Menu */}
                  <td className="py-3 px-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5 relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTradeToken(token);
                        }}
                        className="btn-primary px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition active:scale-[0.98] cursor-pointer"
                      >
                        Swap
                      </button>

                      {/* ⋯ Menu Trigger */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuTokenId(isMenuOpen ? null : token.id);
                        }}
                        className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition cursor-pointer"
                        title="More options"
                      >
                        <MoreHorizontal size={14} />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-1.5 shadow-xl z-30 space-y-1 text-xs text-left animate-meridian-rise"
                        >
                          <a
                            href={token.dexUrl || `https://dexscreener.com/base/${token.address}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setActiveMenuTokenId(null)}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--ink)] transition"
                          >
                            <span>DexScreener</span>
                            <ExternalLink size={12} className="text-[var(--ink-muted)]" />
                          </a>

                          <a
                            href={`https://basescan.org/token/${token.address}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setActiveMenuTokenId(null)}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--ink)] transition"
                          >
                            <span>Basescan</span>
                            <ExternalLink size={12} className="text-[var(--ink-muted)]" />
                          </a>

                          <button
                            type="button"
                            onClick={(e) => {
                              handleCopy(token.address, token.id, e);
                              setActiveMenuTokenId(null);
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--ink)] transition cursor-pointer"
                          >
                            <span>Copy Address</span>
                            {isCopied ? (
                              <Check size={12} className="text-emerald-500" />
                            ) : (
                              <Copy size={12} className="text-[var(--ink-muted)]" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List Fallback */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {tokens.map((token) => (
          <TokenCard
            key={token.id}
            token={token}
            onTrade={onTradeToken}
            onSelect={onSelectToken}
            onToggleWatch={onToggleWatch}
            isWatched={watchlist.includes(token.address.toLowerCase())}
          />
        ))}
      </div>
    </div>
  );
}
