"use client";

import Link from "next/link";
import { RefreshCcw } from "lucide-react";
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
}: AppHeaderProps) {
  const mode = modeFromTab(tab);

  const pickTab = (next: AppTab, guestOk?: boolean) => {
    if (guest && !guestOk) {
      onConnect?.();
      return;
    }
    onTabChange(next);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
      <div className="app-container">
        {/* Row 1 — brand + wallet actions (never overlaps nav) */}
        <div className="flex min-w-0 items-center justify-between gap-3 py-2.5 sm:py-3">
          <Link href="/explore" className="group flex shrink-0 items-center gap-2.5">
            <AppLogo size="sm" />
            <span className="font-display truncate text-base font-bold tracking-tight text-[var(--ink)] sm:text-xl">
              <span className="sm:hidden">Base</span>
              <span className="hidden sm:inline">Base Analytics</span>
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
              <div className="flex items-center gap-1 text-xs sm:gap-2">
                {!siweAuthenticated && onSiweSignIn && (
                  <button
                    type="button"
                    onClick={onSiweSignIn}
                    disabled={siweSigningIn}
                    className="inline-flex shrink-0 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-900 hover:bg-amber-500/15 sm:text-[11px] disabled:opacity-60 touch-manipulation"
                  >
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
                  href={`/creator/${walletAddress}`}
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

        {/* Row 2 — desktop nav (full width, no overlap with wallet row) */}
        <nav
          aria-label="Main"
          className="hidden min-w-0 items-center gap-0.5 overflow-x-auto pb-2.5 text-sm no-scrollbar lg:flex xl:gap-1"
        >
          {HEADER_NAV.map((item) => {
            const active = navActive(item.tab, tab);
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => pickTab(item.tab, item.guestOk)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 transition ${
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
            href={walletAddress ? `/creator/${walletAddress}` : "/profile"}
            className="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[var(--muted)] transition hover:text-[var(--ink)]"
          >
            Profile
          </Link>
          <Link
            href="/docs"
            className="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[var(--muted)] transition hover:text-[var(--ink)]"
          >
            Documents
          </Link>
        </nav>
      </div>

      {/* Sync strip — below nav, never covers links */}
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
