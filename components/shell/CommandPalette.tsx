"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Command,
  Search,
  ArrowRight,
  Flame,
  BookOpen,
  ShieldCheck,
  Calculator,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { shortAddr } from "@/lib/launchpad/format";
import { APP_NAV } from "@/lib/nav/app-nav";
import TokenLogo from "@/components/ui/TokenLogo";
import { parseIntent, type ParsedIntent } from "@/lib/intent/intent-parser";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  tokens: LaunchedToken[];
  onOpenToken?: (token: LaunchedToken) => void;
};

export default function CommandPalette({
  open,
  onClose,
  tab,
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

  const navItems = useMemo(() => {
    const list: Array<{
      id: AppTab | string;
      label: string;
      hint: string;
      icon: LucideIcon;
      href?: string;
    }> = APP_NAV.map((n) => ({
      id: n.id,
      label: n.label,
      hint: n.hint,
      icon: n.icon,
    }));
    list.push({
      id: "lend",
      label: "Yield & APY Calculator",
      hint: "Simulate lending, auto-compounding & staking returns",
      icon: Calculator,
    });
    list.push({
      id: "launchpad",
      label: "Tokenized Equities & RWAs",
      hint: "NVDAc, AAPLc, TSLAc 24/5 equity trading on Base",
      icon: TrendingUp,
    });
    list.push({
      id: "profile",
      label: "Daily Actions & Streaks",
      hint: "Check-in, Daily Boost, GM/GN on Base",
      icon: Flame,
    });
    list.push({
      id: "docs",
      label: "Documents & Developer API",
      hint: "REST endpoints, MCP tools, and smart contracts",
      icon: BookOpen,
      href: "/docs",
    });
    list.push({
      id: "compliance",
      label: "Compliance & Safety Guardrails",
      hint: "Exit-only invariant, geo-gating, and edge kill switch",
      icon: ShieldCheck,
      href: "/docs#compliance",
    });
    return list;
  }, []);

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter(
      (n) => n.label.toLowerCase().includes(q) || n.hint.toLowerCase().includes(q)
    );
  }, [query, navItems]);

  const selectNav = useCallback(
    (item: (typeof navItems)[number]) => {
      if (item.href) {
        router.push(item.href);
      } else {
        onTabChange(item.id as AppTab);
      }
      onClose();
    },
    [onTabChange, onClose, router]
  );

  const matchedIntent = useMemo(() => parseIntent(query), [query]);

  const executeIntent = useCallback(
    (intent: ParsedIntent) => {
      if (intent.href.startsWith("/")) {
        router.push(intent.href);
      }
      onTabChange(intent.tab);
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
            placeholder="Search tokens, B20, or type an action (e.g. 'swap 50 USDC to ETH')…"
            className="command-palette-input flex-1 bg-transparent text-[var(--ink)] outline-none placeholder:text-[var(--ink-dim)]"
          />
          <kbd className="hidden sm:inline text-[11px] font-mono text-[var(--ink-muted)] border border-[var(--border-subtle)] rounded-md px-2 py-1">
            esc
          </kbd>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
          {/* Smart Natural-Language Intent Match */}
          {matchedIntent && (
            <div className="mb-4">
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)] flex items-center gap-1.5">
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
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#0052FF] text-white">
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
                <div className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl bg-[#0052FF] text-white text-xs font-bold shadow-xs group-hover:scale-105 transition-transform">
                  <span>{matchedIntent.actionText}</span>
                  <ArrowRight size={14} />
                </div>
              </button>
            </div>
          )}

          {filteredNav.length > 0 && (
            <div className="mb-4">
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                Go to
              </p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {filteredNav.map((item, idx) => {
                  const Icon = item.icon;
                  const active = !item.href && tab === item.id;
                  return (
                    <button
                      key={`${item.id}-${item.label}-${idx}`}
                      type="button"
                      onClick={() => selectNav(item)}
                      className={`pop-row flex items-center gap-3 rounded-xl px-4 py-3.5 text-left cursor-pointer transition-colors ${
                        active
                          ? "bg-[var(--brand-soft)] border border-[var(--brand)] text-[var(--brand-dark)]"
                          : "hover:bg-[var(--surface-2)] border border-transparent text-[var(--ink-soft)]"
                      }`}
                    >
                      <Icon size={18} className="text-[var(--ink-muted)] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold">{item.label}</p>
                        <p className="text-[12px] text-[var(--ink-muted)] truncate">{item.hint}</p>
                      </div>
                      <ArrowRight size={16} className="text-[var(--ink-dim)] shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredTokens.length > 0 && (
            <div>
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                Tradeable tokens
              </p>
              <div className="space-y-1">
                {filteredTokens.map((t) => (
                  <button
                    key={t.address}
                    type="button"
                    onClick={() => {
                      onTabChange("launchpad");
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
