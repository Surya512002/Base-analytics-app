"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Command, Search, ArrowRight, TrendingUp } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import type { RewardsHubView } from "@/lib/utils/app-url";
import { isRewardsHubTab } from "@/lib/utils/app-url";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { shortAddr } from "@/lib/launchpad/format";
import { APP_NAV } from "@/lib/nav/app-nav";
import { requestOpenGuide } from "@/lib/utils/onboarding-tour";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  tab: AppTab;
  onTabChange: (tab: AppTab, opts?: { rewardsView?: RewardsHubView }) => void;
  tokens: LaunchedToken[];
  onOpenToken?: (token: LaunchedToken) => void;
  guest?: boolean;
};

const EXTRA_NAV: { id: AppTab; label: string; hint: string; rewardsView?: RewardsHubView }[] = [
  { id: "checkin", label: "Check-in & quests", hint: "Daily check-in and season XP", rewardsView: "checkin" },
];

const GUIDE_ACTION = {
  id: "replay-guide",
  label: "Replay app guide",
  hint: "Walk through Explore, Analytics, Quests, Vouchers",
} as const;

export default function CommandPalette({
  open,
  onClose,
  tab,
  onTabChange,
  tokens,
  onOpenToken,
  guest = false,
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

  const showGuideAction = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      GUIDE_ACTION.label.toLowerCase().includes(q) ||
      GUIDE_ACTION.hint.toLowerCase().includes(q) ||
      q.includes("guide") ||
      q.includes("tour") ||
      q.includes("onboard")
    );
  }, [query]);

  const selectNav = useCallback(
    (id: AppTab, rewardsView?: RewardsHubView) => {
      onTabChange(id, rewardsView ? { rewardsView } : undefined);
      onClose();
    },
    [onTabChange, onClose]
  );

  const replayGuide = useCallback(() => {
    onClose();
    onTabChange("launchpad");
    window.setTimeout(
      () => requestOpenGuide(guest ? "explore" : "main"),
      80
    );
  }, [onClose, onTabChange, guest]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center p-3 sm:p-6 pt-[6vh] sm:pt-[8vh]"
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
        <div className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-5 sm:px-6 py-4 sm:py-5 shrink-0">
          <Search size={22} className="text-[var(--ink-muted)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tokens, B20, pages…"
            className="command-palette-input flex-1 bg-transparent text-[var(--ink)] outline-none placeholder:text-[var(--ink-dim)]"
          />
          <kbd className="hidden sm:inline text-[11px] font-mono text-[var(--ink-muted)] border border-[var(--border-subtle)] rounded-md px-2 py-1">
            esc
          </kbd>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
          {showGuideAction && (
            <div className="mb-4">
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                Help
              </p>
              <button
                type="button"
                onClick={replayGuide}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface-2)] border border-transparent text-[var(--ink-soft)]"
              >
                <BookOpen size={18} className="text-[var(--ink-muted)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">{GUIDE_ACTION.label}</p>
                  <p className="text-[12px] text-[var(--ink-muted)] truncate">
                    {GUIDE_ACTION.hint}
                  </p>
                </div>
                <ArrowRight size={16} className="text-[var(--ink-dim)] shrink-0" />
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
                    className="w-full flex items-center gap-4 rounded-xl px-4 py-3.5 text-left hover:bg-[var(--surface-2)] border border-transparent hover:border-[var(--border-subtle)] transition-colors"
                  >
                    {t.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.imageUrl}
                        alt=""
                        className="w-11 h-11 rounded-xl object-cover border border-[var(--border-subtle)]"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-sm font-black text-[var(--ink-muted)]">
                        {t.symbol.slice(0, 2)}
                      </div>
                    )}
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
    </div>
  );
}
