"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Command, Search, ArrowRight, TrendingUp } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import type { RewardsHubView } from "@/lib/utils/app-url";
import { isRewardsHubTab } from "@/lib/utils/app-url";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { shortAddr } from "@/lib/launchpad/format";
import { APP_NAV } from "@/lib/nav/app-nav";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  tab: AppTab;
  onTabChange: (tab: AppTab, opts?: { rewardsView?: RewardsHubView }) => void;
  tokens: LaunchedToken[];
  onOpenToken?: (token: LaunchedToken) => void;
};

const EXTRA_NAV: { id: AppTab; label: string; hint: string; rewardsView?: RewardsHubView }[] = [
  { id: "checkin", label: "Stake & earn", hint: "XP / ETH stake boosts", rewardsView: "stake" },
];

export default function CommandPalette({
  open,
  onClose,
  tab,
  onTabChange,
  tokens,
  onOpenToken,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
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
    const base = APP_NAV.map((n) => ({
      id: n.id,
      label: n.label,
      hint: n.hint,
      icon: n.icon,
      rewardsView: undefined as RewardsHubView | undefined,
    }));
    return [...base, ...EXTRA_NAV.map((e) => ({ ...e, icon: TrendingUp }))];
  }, []);

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter(
      (n) => n.label.toLowerCase().includes(q) || n.hint.toLowerCase().includes(q)
    );
  }, [query, navItems]);

  const selectNav = useCallback(
    (id: AppTab, rewardsView?: RewardsHubView) => {
      onTabChange(id, rewardsView ? { rewardsView } : undefined);
      onClose();
    },
    [onTabChange, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-3 sm:p-6 pt-[6vh] sm:pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search spotlight"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="command-palette-shell relative flex flex-col overflow-hidden">
        <div className="h-1 bg-[var(--bg-raised)] shrink-0" />
        <div className="flex items-center gap-4 border-b border-white/10 px-5 sm:px-6 py-4 sm:py-5 shrink-0">
          <Search size={22} className="text-[var(--ink-muted)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tokens, B20, pages…"
            className="command-palette-input flex-1 bg-transparent text-white outline-none placeholder:text-slate-500"
          />
          <kbd className="hidden sm:inline text-[11px] font-mono text-slate-500 border border-white/12 rounded-md px-2 py-1">
            esc
          </kbd>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
          {filteredNav.length > 0 && (
            <div className="mb-4">
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Go to
              </p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {filteredNav.map((item, idx) => {
                  const Icon = item.icon;
                  const active =
                    tab === item.id ||
                    (item.id === "checkin" && isRewardsHubTab(tab) && !item.rewardsView);
                  return (
                    <button
                      key={`${item.id}-${item.label}-${idx}`}
                      type="button"
                      onClick={() => selectNav(item.id, item.rewardsView)}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors ${
                        active
                          ? "bg-[var(--accent-soft)] border border-[var(--accent)] text-white"
                          : "hover:bg-white/[0.06] border border-transparent text-slate-300"
                      }`}
                    >
                      <Icon size={18} className="text-[var(--ink-muted)] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold">{item.label}</p>
                        <p className="text-[12px] text-slate-500 truncate">{item.hint}</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-600 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredTokens.length > 0 && (
            <div>
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
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
                    className="w-full flex items-center gap-4 rounded-xl px-4 py-3.5 text-left hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-colors"
                  >
                    {t.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.imageUrl}
                        alt=""
                        className="w-11 h-11 rounded-xl object-cover border border-white/10"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-sm font-black text-[var(--ink-muted)]">
                        {t.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-white truncate">
                        {t.name}{" "}
                        <span className="text-[var(--ink-muted)]">${t.symbol}</span>
                      </p>
                      <p className="text-[12px] text-slate-500 font-mono">{shortAddr(t.address)}</p>
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
            <p className="px-4 py-16 text-center text-[15px] text-slate-500">
              No results — try a token symbol or page name
            </p>
          )}
        </div>

        <div className="border-t border-white/10 px-5 py-3 flex items-center gap-2 text-[12px] text-slate-500 shrink-0">
          <Command size={14} />
          <span>
            <kbd className="font-mono text-slate-400">⌘K</kbd> spotlight · search &amp; trade without leaving the app
          </span>
        </div>
      </div>
    </div>
  );
}
