"use client";

import Link from "next/link";
import { ChevronRight, Gift, HelpCircle, Languages, Moon, Rocket } from "lucide-react";
import LanguageSelector from "@/components/ui/LanguageSelector";
import ThemeToggle from "@/components/ui/ThemeToggle";

const LINKS = [
  { href: "/?tab=basehub", label: "Send or receive a gift", icon: Gift },
  { href: "/launch", label: "Launch a token", icon: Rocket },
  { href: "/help", label: "Help and safety", icon: HelpCircle },
] as const;

/** Settings and the places phones have no bottom-bar button for. Lives on the Account pages. */
export default function AccountSettings() {
  const row = "flex min-h-[56px] items-center gap-3 px-4 py-2 text-[15px] font-bold text-[var(--ink)]";
  return (
    <section id="settings" aria-label="Settings and help" className="mx-auto w-full max-w-3xl scroll-mt-24">
      <div className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)]">
        <div className={`${row} justify-between`}>
          <span className="flex items-center gap-3"><Languages size={18} aria-hidden className="text-[var(--ink-muted)]" /> Language</span>
          <LanguageSelector />
        </div>
        <div className={`${row} justify-between`}>
          <span className="flex items-center gap-3"><Moon size={18} aria-hidden className="text-[var(--ink-muted)]" /> Light or dark</span>
          <ThemeToggle />
        </div>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`${row} hover:bg-[var(--surface-2)]`}>
            <l.icon size={18} aria-hidden className="text-[var(--ink-muted)]" />
            <span className="flex-1">{l.label}</span>
            <ChevronRight size={16} aria-hidden className="text-[var(--ink-dim)]" />
          </Link>
        ))}
      </div>
    </section>
  );
}
