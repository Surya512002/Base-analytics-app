"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Command,
  Search,
  ArrowRight,
  Zap,
} from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { shortAddr } from "@/lib/launchpad/format";
import { searchEntries } from "@/lib/nav/directory";
import TokenLogo from "@/components/ui/TokenLogo";
import { parseIntent, type ParsedIntent } from "@/lib/intent/intent-parser";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  onTabChange: (tab: AppTab) => void;
  tokens: LaunchedToken[];
  onOpenToken?: (token: LaunchedToken) => void;
};

export default function CommandPalette({
  open,
  onClose,
  onTabChange,
  tokens,
  onOpenToken,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filteredTokens = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tokens.slice(0, 12);
    return tokens
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query, tokens]);

  // Pages come from the shared list, so search uses the same names as the menu and Home.
  const filteredNav = useMemo(() => searchEntries(query), [query]);

  const selectNav = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [onClose, router]
  );

  const matchedIntent = useMemo(() => parseIntent(query), [query]);

  const executeIntent = useCallback(
    (intent: ParsedIntent) => {
      if (intent.href.startsWith("/")) {
        router.push(intent.href);
      }
      // "launchpad" now means home; the launch action already went to /launch above.
      if (intent.tab !== "launchpad") onTabChange(intent.tab);
      onClose();
    },
    [router, onTabChange, onClose]
  );

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-3 sm:p-6 pt-[6vh] sm:pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search spotlight"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-md animate-meridian-fade"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="command-palette-shell relative flex flex-col overflow-hidden animate-meridian-scale">
        <div className="h-1 bg-[var(--bg-raised)] shrink-0" />
        <div className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-5 sm:px-6 py-4 sm:py-5 shrink-0">
          <Search size={22} className="text-[var(--ink-muted)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matchedIntent) {
                e.preventDefault();
                executeIntent(matchedIntent);
              }
            }}
            placeholder='Search, or try "gift", "limit order" or "borrow"'
            aria-label="Search pages and tokens"
            className="command-palette-input flex-1 bg-transparent text-[var(--ink)] outline-none placeholder:text-[var(--ink-dim)]"
          />
          <kbd className="hidden sm:inline text-[11px] font-mono text-[var(--ink-muted)] border border-[var(--border-subtle)] rounded-md px-2 py-1">
            esc
          </kbd>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 min-h-0">
          {/* Smart Natural-Language Intent Match */}
          {matchedIntent && (
            <div className="mb-4">
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--brand)] flex items-center gap-1.5">
                <Zap size={13} className="text-[var(--brand)] fill-current" />
                <span>Smart Intent Detected</span>
              </p>
              <button
                type="button"
                onClick={() => executeIntent(matchedIntent)}
                className="w-full text-left rounded-2xl border-2 border-[var(--brand)] bg-[var(--brand-soft)] hover:bg-[var(--brand-soft)]/80 p-4 transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[var(--brand)] text-white">
                      {matchedIntent.type}
                    </span>
                    <span className="text-[15px] font-black text-[var(--ink)] truncate">
                      {matchedIntent.label}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink-muted)] mt-1 truncate">
                    {matchedIntent.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl bg-[var(--brand)] text-white text-xs font-bold shadow-xs group-hover:scale-105 transition-transform">
                  <span>{matchedIntent.actionText}</span>
                  <ArrowRight size={14} />
                </div>
              </button>
            </div>
          )}

          {filteredNav.length > 0 && (
            <div className="mb-4">
              <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                Go to
              </p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {filteredNav.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectNav(item.href)}
                    className="flex min-h-[56px] items-center gap-3 rounded-xl border border-transparent px-4 py-2.5 text-left cursor-pointer transition-colors text-[var(--ink-soft)] hover:bg-[var(--surface-2)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-[var(--ink)]">
                        {item.title}
                        {item.soon && <span className="ml-2 text-[13px] font-semibold text-[var(--ink-muted)]">Coming soon</span>}
                      </p>
                      <p className="text-[13px] text-[var(--ink-muted)] truncate">{item.note}</p>
                    </div>
                    <ArrowRight size={16} aria-hidden className="text-[var(--ink-dim)] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredTokens.length > 0 && (
            <div>
              <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                Tradeable tokens
              </p>
              <div className="space-y-1">
                {filteredTokens.map((t) => (
                  <button
                    key={t.address}
                    type="button"
                    onClick={() => {
                      onOpenToken?.(t);
                      onClose();
                    }}
                    className="pop-row w-full flex items-center gap-4 rounded-xl px-4 py-3.5 text-left hover:bg-[var(--surface-2)] border border-transparent hover:border-[var(--border-subtle)] transition-colors cursor-pointer"
                  >
                    <TokenLogo
                      address={t.address}
                      symbol={t.symbol}
                      src={t.imageUrl}
                      size={44}
                      shape="rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-[var(--ink)] truncate">
                        {t.name}{" "}
                        <span className="text-[var(--ink-muted)]">${t.symbol}</span>
                      </p>
                      <p className="text-[12px] text-[var(--ink-muted)] font-mono">{shortAddr(t.address)}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-400/90 shrink-0">
                      Trade →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredNav.length === 0 && filteredTokens.length === 0 && (
            <p className="px-4 py-16 text-center text-[15px] text-[var(--ink-muted)]">
              No results — try a token symbol or page name
            </p>
          )}
        </div>

        <div className="border-t border-[var(--border-subtle)] px-5 py-3 flex items-center gap-2 text-[12px] text-[var(--ink-muted)] shrink-0">
          <Command size={14} />
          <span>
            <kbd className="font-mono text-[var(--ink-dim)]">⌘K</kbd> spotlight · search &amp; trade without leaving the app
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
