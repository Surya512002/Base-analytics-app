"use client";

import { Star } from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import { formatCompactUsd, formatExactUsd, isExtremeMove, isLowLiquidity, isNewToken } from "@/lib/explore/explore-config";
import TokenAvatar from "@/components/ui/TokenAvatar";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import { useStockSwapRestricted } from "./TokenCard";

/** The one warning worth showing in a short row; the full details open on tap. */
function warning(token: UnifiedToken): string | null {
  if (!token.hasPool) return "No pool";
  if (isLowLiquidity(token)) return "Low liquidity";
  if (isExtremeMove(token)) return "Big move";
  return isNewToken(token) ? "New" : null;
}

/** One token as a single line on phones: tap for details, or Swap straight away. */
export default function TokenRow({
  token,
  onTrade,
  onSelect,
  isWatched = false,
}: {
  token: UnifiedToken;
  onTrade: (token: UnifiedToken) => void;
  onSelect: (token: UnifiedToken) => void;
  isWatched?: boolean;
}) {
  const restricted = useStockSwapRestricted(token);
  const flag = warning(token);
  const change = token.priceChange24h;

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <button type="button" onClick={() => onSelect(token)} className="flex min-h-[48px] min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left">
        <TokenAvatar src={token.imageUrl} address={token.address} symbol={token.symbol} className="h-9 w-9 shrink-0 rounded-xl" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="truncate text-sm font-bold text-[var(--ink)]">{token.symbol}</span>
            {token.isVerified && <VerifiedBadge size={13} />}
            {isWatched && <Star size={11} aria-label="On your watchlist" className="shrink-0 fill-amber-500 text-amber-500" />}
          </span>
          <span className="block truncate text-[11px] text-[var(--ink-muted)]">
            {flag ? <span className="font-bold text-amber-700 dark:text-amber-300">{flag} · </span> : null}
            Vol {formatCompactUsd(token.volume24h)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-sm font-bold tabular-nums text-[var(--ink)]">{formatExactUsd(token.priceUsd)}</span>
          <span className={`block font-mono text-[11px] font-bold tabular-nums ${change > 0 ? "text-emerald-600 dark:text-emerald-400" : change < 0 ? "text-red-600 dark:text-red-400" : "text-[var(--ink-muted)]"}`}>
            {change > 0 ? "+" : ""}
            {change.toFixed(1)}%
          </span>
        </span>
      </button>
      <button
        type="button"
        disabled={restricted}
        onClick={() => onTrade(token)}
        title={restricted ? "Tokenized stock features are not available in your region" : undefined}
        aria-label={`Swap ${token.symbol}`}
        className={`min-h-[40px] shrink-0 rounded-lg px-3 text-xs font-bold ${restricted ? "cursor-not-allowed border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] opacity-60" : "btn-primary cursor-pointer"}`}
      >
        Swap
      </button>
    </li>
  );
}
