"use client";

import { useState, useRef, useEffect } from "react";
import ActivePill from "@/components/ui/motion/ActivePill";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ActivePlace from "@/components/shell/ActivePlace";
import { PLACE_HREF, TOP_NAV } from "@/lib/nav/directory";
import {
  RefreshCcw,
  ChevronDown,
  Copy,
  Check,
  User,
  LogOut,
  ShieldCheck,
  Globe,
  ExternalLink,
  Search,
} from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import LanguageSelector from "@/components/ui/LanguageSelector";
import { useI18n } from "@/lib/i18n/context";
import type { AppTab } from "@/hooks/useWalletApp";

interface AppHeaderProps {
  tab: AppTab;
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

export default function AppHeader({
  tab,
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
  const pathname = usePathname();
  const router = useRouter();
  const profileHref = walletAddress ? `/creator/${walletAddress}` : "/profile";

  const { t } = useI18n();

  // The header becomes a floating pill once the page is scrolled.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // Account Menu dropdown state
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    if (accountMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [accountMenuOpen]);

  const handleCopyAddress = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full pt-[env(safe-area-inset-top,0px)] transition-colors duration-300 ${
        scrolled
          ? "border-b border-transparent max-lg:bg-transparent lg:border-[var(--border)] lg:bg-[var(--surface)]/90 lg:backdrop-blur-md"
          : "border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md"
      }`}
    >
      <div className="app-container">
        {/* Main Header Bar — on phones it becomes a floating rounded pill after scrolling */}
        <div
          className={`flex min-w-0 items-center justify-between gap-3 py-2.5 transition-all duration-300 sm:py-3 ${
            scrolled
              ? "max-lg:mt-2 max-lg:rounded-2xl max-lg:border max-lg:border-[var(--border-subtle)] max-lg:bg-[var(--surface)]/95 max-lg:px-3 max-lg:shadow-lg max-lg:backdrop-blur-md"
              : ""
          }`}
        >
          {/* Left: Brand Logo & Title */}
          <Link href="/" className="group flex min-w-0 items-center gap-2.5 sm:shrink-0">
            <AppLogo size="sm" />
            <span className="font-display truncate text-base font-bold tracking-tight text-[var(--ink)] max-[359px]:sr-only sm:text-xl">
              Base Analytics
            </span>
          </Link>

          {/* Computer menu */}
          <nav aria-label="Main" className="hidden min-w-0 flex-1 text-[15px] lg:block">
            <ActivePlace tab={tab}>
              {(place) => (
                <ul className="flex items-center gap-1">
                  {TOP_NAV.map((id) => (
                    <li key={id}>
                      <Link
                        href={PLACE_HREF[id]}
                        aria-current={place === id ? "page" : undefined}
                        className={`block whitespace-nowrap rounded-[10px] px-3 py-2 font-semibold transition-colors ${
                          place === id ? "bg-[var(--surface-2)] text-[var(--brand-text)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                        }`}
                      >
                        {t.nav[id]}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </ActivePlace>
          </nav>

          {/* Right: ONE Unified Account Area */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Search tokens and pages"
              onClick={() => {
                // Pages inside the app shell have the search window; the rest go to the token search.
                if (document.querySelector("[data-command-palette-host]")) {
                  window.dispatchEvent(new Event("open-command-palette"));
                } else {
                  router.push("/explore");
                }
              }}
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[var(--edge)] text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
            >
              <Search size={18} aria-hidden />
            </button>
            <Link
              href={profileHref}
              aria-label={t.nav.account}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--edge)] text-[var(--ink)] transition hover:bg-[var(--surface-2)] lg:hidden"
            >
              <User size={18} aria-hidden />
            </Link>
            {guest || !walletAddress ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="hidden items-center gap-2 xl:flex">
                  <LanguageSelector />
                  <ThemeToggle />
                </div>
                <button
                  type="button"
                  onClick={onConnect}
                  data-connect
                  className="btn-primary min-h-11 whitespace-nowrap rounded-xl px-3.5 text-[13px] font-bold transition cursor-pointer sm:text-sm"
                >
                  <span className="hidden sm:inline">{t.actions.connectWallet}</span>
                  <span className="sm:hidden">Connect</span>
                </button>
              </div>
            ) : (
              /* Connected: ONE Single Account Trigger with Dropdown */
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  className="pop-pill flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] hover:border-[var(--brand)]/40 text-xs text-[var(--ink)] font-bold transition shadow-xs cursor-pointer select-none"
                  aria-expanded={accountMenuOpen}
                  aria-label="Account menu"
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="font-mono">
                    {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-[var(--ink-muted)] transition-transform ${
                      accountMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Account Dropdown Menu */}
                {accountMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-3)] p-3 shadow-xl z-50 animate-meridian-rise space-y-2.5">
                    {/* Wallet Header & Copy */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
                      <div className="min-w-0">
                        <span className="text-[11px] uppercase font-bold tracking-wider text-[var(--ink-muted)] block">
                          Connected Wallet
                        </span>
                        <p className="font-mono font-bold text-xs text-[var(--ink)] truncate">
                          {walletAddress.slice(0, 8)}…{walletAddress.slice(-6)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyAddress}
                        className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-3)] transition cursor-pointer"
                        title="Copy address"
                      >
                        {copied ? (
                          <Check size={14} className="text-emerald-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>

                    {/* Network & Theme Controls */}
                    <div className="space-y-1.5 py-1 text-xs">
                      <div className="flex items-center justify-between px-2 py-1.5 text-[var(--ink-muted)]">
                        <span className="flex items-center gap-1.5">
                          <Globe size={13} className="text-[var(--brand-text)]" />
                          <span>Network</span>
                        </span>
                        <span className="font-bold text-[var(--brand-text)] bg-[var(--brand-soft)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full text-[11px]">
                          Base Mainnet
                        </span>
                      </div>

                      <div className="flex items-center justify-between px-2 py-1 text-[var(--ink-muted)]">
                        <span>Language</span>
                        <LanguageSelector />
                      </div>

                      <div className="flex items-center justify-between px-2 py-1 text-[var(--ink-muted)]">
                        <span>Theme Mode</span>
                        <ThemeToggle />
                      </div>
                    </div>

                    <div className="h-px bg-[var(--border-subtle)]" />

                    {/* Authentication Status / Sign In */}
                    {!siweAuthenticated && onSiweSignIn ? (
                      <button
                        type="button"
                        onClick={() => {
                          onSiweSignIn();
                          setAccountMenuOpen(false);
                        }}
                        disabled={siweSigningIn}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-500/20 transition cursor-pointer"
                      >
                        <span>Sign In with Ethereum</span>
                        <span>{siweSigningIn ? "…" : "→"}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck size={14} />
                        <span>Verified SIWE Session</span>
                      </div>
                    )}

                    {/* Profile Link */}
                    <Link
                      href={profileHref}
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-2)] transition"
                    >
                      <span className="flex items-center gap-2">
                        <User size={14} className="text-[var(--ink-muted)]" />
                        <span>View Profile &amp; Stats</span>
                      </span>
                      <ExternalLink size={12} className="text-[var(--ink-muted)]" />
                    </Link>

                    <div className="h-px bg-[var(--border-subtle)]" />

                    {/* Sign Out Action */}
                    {onDisconnect && (
                      <button
                        type="button"
                        onClick={() => {
                          onDisconnect();
                          setAccountMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                      >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync strip — below nav, never covers links */}
      {walletRefreshing && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--brand-soft)]/40">
          <div className="app-container flex items-center gap-2 py-1.5 text-xs text-[var(--brand-dark)]">
            <RefreshCcw className="size-3.5 shrink-0 animate-spin" aria-hidden />
            <span className="min-w-0 truncate font-medium">
              {scanProgress || "Syncing wallet balances…"}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
