"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Command, Search, TrendingUp, X } from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { shortAddr } from "@/lib/launchpad/format";
import {
  filterTokensByQuery,
  pushRecentSearch,
  readRecentSearches,
} from "@/lib/launchpad/token-search";

const SHORTCUTS = [
  { label: "Trending", query: "" },
  { label: "B20", query: "b20" },
  { label: "Gainers", query: "gain" },
];

export default function ExploreSearchBar({
  tokens,
  onOpenToken,
  onBrowseTrending,
}: {
  tokens: LaunchedToken[];
  onOpenToken: (token: LaunchedToken) => void;
  onBrowseTrending?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecent(readRecentSearches());
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => filterTokensByQuery(tokens, query), [tokens, query]);

  const selectToken = useCallback(
    (t: LaunchedToken, q?: string) => {
      if (q) pushRecentSearch(q);
      else pushRecentSearch(t.symbol);
      setRecent(readRecentSearches());
      setQuery("");
      setOpen(false);
      onOpenToken(t);
    },
    [onOpenToken]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      onBrowseTrending?.();
      return;
    }
    if (results[0]) selectToken(results[0], q);
    else pushRecentSearch(q);
    setRecent(readRecentSearches());
  };

  return (
    <div ref={wrapRef} className="relative">
      <form onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-dim)] pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search tokens, symbol, or 0x address…"
            className="w-full min-h-[48px] pl-10 pr-10 rounded-xl border border-white/[0.1] bg-[var(--bg-raised)] text-[14px] text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none focus:border-[#0052FF]/50"
            aria-label="Search tokens"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-dim)] hover:text-white"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          className="shrink-0 min-h-[48px] px-3 rounded-xl border border-white/[0.1] text-[var(--ink-dim)] hover:text-white hover:border-[#0052FF]/40 transition-colors"
          aria-label="Open command palette"
        >
          <Command size={16} />
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mt-2">
        {SHORTCUTS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => {
              if (!s.query) onBrowseTrending?.();
              else setQuery(s.query);
              setOpen(true);
            }}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/[0.08] text-[var(--ink-muted)] hover:text-white hover:border-[#0052FF]/30"
          >
            {s.label}
          </button>
        ))}
      </div>

      {open && (query || recent.length > 0) && (
        <div className="absolute z-40 mt-2 w-full rounded-xl border border-white/[0.1] bg-[#080808]/98 backdrop-blur-md shadow-2xl overflow-hidden max-h-[min(360px,50vh)] overflow-y-auto">
          {query && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-[var(--ink-dim)]">No tokens match “{query}”</p>
          )}
          {results.map((t) => (
            <button
              key={t.address}
              type="button"
              onClick={() => selectToken(t, query)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] border-b border-white/[0.05] last:border-0"
            >
              <TrendingUp size={14} className="text-[#6BA3FF] shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {t.name}{" "}
                  <span className="text-[#6BA3FF] font-mono">${t.symbol}</span>
                </p>
                <p className="text-[10px] text-[var(--ink-dim)] font-mono">{shortAddr(t.address)}</p>
              </div>
            </button>
          ))}
          {!query && recent.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
                Recent
              </p>
              {recent.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setQuery(r)}
                  className="w-full text-left px-3 py-2 text-sm text-[var(--ink-muted)] hover:text-white rounded-lg hover:bg-white/[0.05]"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
