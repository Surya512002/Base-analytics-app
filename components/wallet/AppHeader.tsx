"use client";

import Link from "next/link";
import { Loader2, RefreshCcw, ShieldCheck, X } from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import type { AppTab } from "@/hooks/useWalletApp";
import { isRewardsHubTab } from "@/lib/utils/app-url";

type AppMode = "launch" | "trade";

interface AppHeaderProps {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  guest?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  walletAddress?: string | null;
  walletRefreshing?: boolean;
  scanProgress?: string;
  siweAuthenticated?: boolean;
  siweSigningIn?: boolean;
  onSiweSignIn?: () => void;
  /** When true, hide the full-width top sign-in strip (compact header button still shows). */
  siwePromptDismissed?: boolean;
  onSiweSkip?: () => void;
  /** Session resolved — avoid flashing sign-in before we know status. */
  siweSessionChecked?: boolean;
}

const HEADER_NAV: { tab: AppTab; label: string; guestOk?: boolean }[] = [
  { tab: "launchpad", label: "Explore", guestOk: true },
  { tab: "swap", label: "Swap", guestOk: true },
  { tab: "dashboard", label: "Analytics" },
  { tab: "basehub", label: "Vouchers" },
  { tab: "checkin", label: "Quests" },
  { tab: "achievements", label: "Badges" },
];

function modeFromTab(tab: AppTab): AppMode {
  if (tab === "launchpad" || tab === "basehub") return "launch";
  return "trade";
}

function navActive(tab: AppTab, active: AppTab): boolean {
  if (tab === "checkin") return isRewardsHubTab(active);
  return active === tab;
}

export default function AppHeader({
  tab,
  onTabChange,
  guest,
  onConnect,
  onDisconnect,
  walletAddress,
  walletRefreshing,
  scanProgress,
  siweAuthenticated,
  siweSigningIn,
  onSiweSignIn,
  siwePromptDismissed,
  onSiweSkip,
  siweSessionChecked = true,
}: AppHeaderProps) {
  const mode = modeFromTab(tab);
  const profileHref = walletAddress ? `/creator/${walletAddress}` : "/profile";
  const showTopSignIn =
    !guest &&
    Boolean(walletAddress) &&
    siweSessionChecked &&
    !siweAuthenticated &&
    Boolean(onSiweSignIn) &&
    !siwePromptDismissed;

  const pickTab = (next: AppTab, guestOk?: boolean) => {
    if (guest && !guestOk) {
      onConnect?.();
      return;
    }
    onTabChange(next);
  };

  const navLinks = (
    <>
      {HEADER_NAV.map((item) => {
        const active = navActive(item.tab, tab);
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => pickTab(item.tab, item.guestOk)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 transition touch-manipulation ${
              active
                ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand-dark)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {item.label}
          </button>
        );
      })}
      <Link
        href={profileHref}
        className="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[var(--muted)] transition hover:text-[var(--ink)] touch-manipulation"
      >
        Profile
      </Link>
      <Link
        href="/docs"
        className="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[var(--muted)] transition hover:text-[var(--ink)] touch-manipulation"
      >
        Documents
      </Link>
    </>
  );

  return (
    <header className="app-header-shell sticky top-0 z-50 w-full pt-[env(safe-area-inset-top,0px)]">
      <div className="app-container">
        {/* Row 1 — brand + wallet actions (never overlaps nav) */}
        <div className="flex min-w-0 items-center justify-between gap-3 py-2.5 sm:py-3">
          <Link href="/explore" className="group flex shrink-0 items-center gap-2.5">
            <AppLogo size="sm" />
            <span className="font-display truncate text-base font-bold tracking-tight text-[var(--ink)] sm:text-xl">
              <span className="sm:hidden">Base</span>
              <span className="hidden sm:inline text-gradient-hero">Base Analytics</span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-0.5 text-xs md:flex">
              <button
                type="button"
                onClick={() => pickTab("launchpad", true)}
                className={`whitespace-nowrap rounded-full px-2.5 py-1.5 font-medium transition lg:px-3 ${
                  mode === "launch" ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"
                }`}
              >
                Launch / B20
              </button>
              <button
                type="button"
                onClick={() => pickTab("swap", true)}
                className={`whitespace-nowrap rounded-full px-2.5 py-1.5 font-medium transition lg:px-3 ${
                  mode === "trade" ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"
                }`}
              >
                Trade / Swap
              </button>
            </div>

            <span className="badge badge-brand hidden xl:inline-flex">Base Mainnet</span>

            {guest || !walletAddress ? (
              <button
                type="button"
                onClick={onConnect}
                className="btn-primary whitespace-nowrap px-3 py-2 text-xs sm:px-4 sm:text-sm"
              >
                <span className="sm:hidden">Connect</span>
                <span className="hidden sm:inline">Connect wallet</span>
              </button>
            ) : (
              <div className="flex max-w-[min(100%,14rem)] items-center gap-1 overflow-x-auto no-scrollbar text-xs sm:max-w-none sm:gap-2">
                {!siweAuthenticated && onSiweSignIn && (
                  <button
                    type="button"
                    onClick={onSiweSignIn}
                    disabled={siweSigningIn}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-950 hover:bg-amber-500/25 sm:text-[11px] disabled:opacity-60 touch-manipulation"
                  >
                    {siweSigningIn ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={12} />
                    )}
                    {siweSigningIn ? "…" : "Sign in"}
                  </button>
                )}
                {siweAuthenticated && (
                  <span
                    className="inline-flex shrink-0 rounded-lg bg-emerald-500/12 px-1.5 py-1 text-[9px] font-bold text-emerald-800 sm:px-2 sm:text-[10px]"
                    title="Signed in"
                  >
                    <span className="sm:hidden" aria-hidden>
                      ✓
                    </span>
                    <span className="hidden sm:inline">Signed in</span>
                  </span>
                )}
                <Link
                  href={profileHref}
                  className="inline-flex shrink-0 rounded-lg bg-[var(--brand-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--brand-dark)] hover:bg-[var(--brand)]/15 sm:text-xs touch-manipulation"
                >
                  Profile
                </Link>
                <span className="hidden rounded-lg bg-[var(--surface-2)] px-2 py-1 font-mono md:inline">
                  {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                </span>
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="btn-ghost shrink-0 px-2 text-[10px] sm:text-xs touch-manipulation"
                >
                  Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop only — phones use MobileBottomNav only (no duplicate Explore/Swap/…) */}
        <nav
          aria-label="Main"
          className="max-lg:!hidden min-w-0 items-center gap-0.5 overflow-x-auto pb-2.5 text-sm no-scrollbar lg:flex xl:gap-1"
        >
          {navLinks}
        </nav>
      </div>

      {/* Top sticky sign-in — always under brand/nav for every tab & page */}
      {showTopSignIn && (
        <div
          className="sign-in-top-bar"
          role="region"
          aria-label="Sign in with your wallet"
        >
          <div className="app-container flex flex-col gap-2.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-3">
            <div className="min-w-0 flex items-start gap-2.5 sm:items-center">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] border border-[var(--brand)]/20 sm:mt-0">
                {siweSigningIn ? (
                  <Loader2 size={18} className="animate-spin text-[var(--brand)]" />
                ) : (
                  <ShieldCheck size={18} className="text-[var(--brand)]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-dark)]">
                  Sign in required
                </p>
                <p className="text-sm font-semibold text-[var(--ink)] leading-snug">
                  {siweSigningIn
                    ? "Confirm the signature in your wallet…"
                    : "Verify wallet ownership for launches, profile & creator fees"}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--ink-muted)] leading-snug">
                  Free message · no gas · stays active across Explore, Swap, Analytics & more
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
              <button
                type="button"
                onClick={onSiweSignIn}
                disabled={siweSigningIn}
                className="btn-primary inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold sm:flex-none touch-manipulation"
              >
                {siweSigningIn ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Signing…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={15} />
                    Sign in
                  </>
                )}
              </button>
              {onSiweSkip && (
                <button
                  type="button"
                  onClick={onSiweSkip}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-[11px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] touch-manipulation"
                  aria-label="Dismiss sign-in for now"
                >
                  <span className="sm:hidden">
                    <X size={16} />
                  </span>
                  <span className="hidden sm:inline">Skip</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sync strip — below nav / sign-in */}
      {walletRefreshing && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--brand-soft)]/40">
          <div className="app-container flex items-center gap-2 py-1.5 text-xs text-[var(--brand-dark)]">
            <RefreshCcw className="size-3.5 shrink-0 animate-spin" aria-hidden />
            <span className="min-w-0 truncate font-medium">
              {scanProgress || "Syncing wallet analytics…"}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
