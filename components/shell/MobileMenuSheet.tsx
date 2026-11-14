"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeftRight,
  ChevronRight,
  Compass,
  Gift,
  HelpCircle,
  Landmark,
  Languages,
  LogOut,
  Moon,
  Rocket,
  User,
  type LucideIcon,
} from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import LanguageSelector from "@/components/ui/LanguageSelector";
import { useUniqueUsers } from "@/hooks/useUniqueUsers";
import type { AppTab } from "@/hooks/useWalletApp";

type Item = { id: string; icon: LucideIcon; title: string; note: string; tab?: AppTab; href?: string; guestOk?: boolean };

const ITEMS: Item[] = [
  { id: "explore", icon: Compass, title: "Explore", note: "Live tokens, trades and stocks", tab: "launchpad", guestOk: true },
  { id: "swap", icon: ArrowLeftRight, title: "Swap", note: "Best route across Base DEXs", tab: "swap", guestOk: true },
  { id: "lend", icon: Landmark, title: "Lend & Stake", note: "Borrow against stocks, earn yield", tab: "lend", guestOk: true },
  { id: "vouchers", icon: Gift, title: "Vouchers", note: "Send gifts with one link", tab: "basehub", guestOk: true },
  { id: "launch", icon: Rocket, title: "Launch", note: "Launch a token, earn on every trade", href: "/launch" },
  { id: "profile", icon: User, title: "Profile", note: "Your launches and revenue" },
];

/**
 * Phone menu (openlaunch-style floating card): every section with a one-line description,
 * then language, theme and help, the wallet, and the main call to action.
 */
export default function MobileMenuSheet({
  open,
  onClose,
  activeId,
  guest,
  walletAddress,
  profileHref,
  onPickTab,
  onConnect,
  onDisconnect,
}: {
  open: boolean;
  onClose: () => void;
  activeId: string;
  guest: boolean;
  walletAddress?: string | null;
  profileHref: string;
  onPickTab: (tab: AppTab, guestOk?: boolean) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}) {
  const reduce = useReducedMotion();
  const { formatted: users } = useUniqueUsers();
  // Rendered into <body>: the header's backdrop blur would otherwise become the containing
  // block for these fixed elements and push the sheet off-screen.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Esc closes; the page behind doesn't scroll while the menu is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const row = (it: Item) => {
    const active = it.id === activeId;
    const inner = (
      <>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            active ? "border-[var(--brand)]/40 bg-[var(--brand-soft)] text-[var(--brand-text)]" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)]"
          }`}
        >
          <it.icon size={18} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[15px] font-bold text-[var(--ink)]">{it.title}</span>
          <span className="block truncate text-xs text-[var(--ink-muted)]">{it.note}</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-[var(--ink-dim)]" />
      </>
    );
    const cls = `flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 transition ${active ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]"}`;
    if (it.tab) {
      return (
        <button
          key={it.id}
          type="button"
          aria-current={active ? "page" : undefined}
          onClick={() => {
            onPickTab(it.tab!, it.guestOk);
            onClose();
          }}
          className={`${cls} cursor-pointer`}
        >
          {inner}
        </button>
      );
    }
    return (
      <Link key={it.id} href={it.href ?? profileHref} onClick={onClose} aria-current={active ? "page" : undefined} className={cls}>
        {inner}
      </Link>
    );
  };

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            aria-hidden
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+64px)] z-[61] max-h-[calc(100dvh-80px)] overflow-y-auto rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2 shadow-2xl md:hidden"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <nav aria-label="Sections" className="space-y-0.5">
              {ITEMS.map(row)}
            </nav>

            <div className="mx-2.5 my-2 h-px bg-[var(--border-subtle)]" />

            <div className="space-y-0.5 px-2.5 text-sm">
              <div className="flex items-center justify-between py-2">
                <span className="flex items-center gap-3 font-semibold text-[var(--ink)]">
                  <Languages size={17} className="text-[var(--ink-muted)]" /> Language
                </span>
                <LanguageSelector />
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="flex items-center gap-3 font-semibold text-[var(--ink)]">
                  <Moon size={17} className="text-[var(--ink-muted)]" /> Theme
                </span>
                <ThemeToggle />
              </div>
              <Link href="/help" onClick={onClose} className="flex items-center justify-between py-2">
                <span className="flex items-center gap-3 font-semibold text-[var(--ink)]">
                  <HelpCircle size={17} className="text-[var(--ink-muted)]" /> Help &amp; safety
                </span>
                <ChevronRight size={15} className="text-[var(--ink-dim)]" />
              </Link>
            </div>

            <div className="mx-2.5 my-2 h-px bg-[var(--border-subtle)]" />

            <div className="space-y-2 p-1.5">
              {guest || !walletAddress ? (
                <button
                  type="button"
                  onClick={() => {
                    onConnect?.();
                    onClose();
                  }}
                  className="w-full cursor-pointer rounded-2xl border border-[var(--border-subtle)] py-3 text-sm font-bold text-[var(--ink)] transition hover:border-[var(--brand)]/50"
                >
                  Connect wallet
                </button>
              ) : (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] px-3 py-2.5">
                  <span className="flex items-center gap-2 font-mono text-xs font-bold text-[var(--ink)]">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                  </span>
                  {onDisconnect && (
                    <button
                      type="button"
                      onClick={() => {
                        onDisconnect();
                        onClose();
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400"
                    >
                      <LogOut size={13} /> Sign out
                    </button>
                  )}
                </div>
              )}
              <Link
                href="/launch"
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] py-3.5 text-sm font-black text-white shadow-lg shadow-[var(--brand)]/25"
              >
                <Rocket size={16} /> Launch a token
              </Link>
            </div>

            <div className="flex items-center justify-between px-3 pb-2 pt-1 text-[11px] text-[var(--ink-muted)]">
              <span>{users !== "0" ? `${users} users on Base` : "Base Analytics"}</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Base mainnet
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
