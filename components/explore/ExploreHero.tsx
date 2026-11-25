"use client";

import React from "react";
import { Search, Command } from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import SpotlightCarousel from "./SpotlightCarousel";
import PageHero from "@/components/ui/PageHero";
import Link from "next/link";
import { AUTO_INVEST_HREF } from "@/lib/constants/destinations";

interface ExploreHeroProps {
  spotlightTokens: UnifiedToken[];
  onOpenToken: (token: UnifiedToken) => void;
  onBrowseTokens: () => void;
  onLaunchToken: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenCommandPalette: () => void;
}

const START = [
  { href: "/trade", title: "Buy a stock", note: "Live chart and one-tap buy" },
  { href: AUTO_INVEST_HREF, title: "Invest automatically", note: "A little every week or month" },
  { href: "/lend", title: "Borrow or earn", note: "Put your stocks to work" },
] as const;

export default function ExploreHero({
  spotlightTokens,
  onOpenToken,
  onBrowseTokens,
  onLaunchToken,
  searchQuery,
  onSearchChange,
  onOpenCommandPalette,
}: ExploreHeroProps) {
  return (
    <div className="space-y-2">
      <PageHero
        as="h2"
        size="sm"
        eyebrow="Explore Base"
        title={
          <>
            Find tokens on Base —{" "}
            <span className="text-[var(--brand-text)]">swap in seconds.</span>
          </>
        }
        subtitle="Pick what you want to do, or search any token on Base."
      >
        <div className="flex w-full flex-col items-start gap-3 sm:items-center">
        <nav aria-label="Start here" className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-3">
          {START.map((s) => (
            <Link key={s.href} href={s.href} className="flex min-h-[64px] flex-col items-start justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 text-left shadow-xs transition hover:border-[var(--brand)]">
              <span className="text-sm font-black text-[var(--ink)]">{s.title}</span>
              <span className="text-[11px] text-[var(--ink-muted)]">{s.note}</span>
            </Link>
          ))}
        </nav>
        <div className="flex gap-4 text-xs font-bold text-white/90">
          <button type="button" onClick={onBrowseTokens} className="min-h-[40px] cursor-pointer underline underline-offset-4">
            Browse tokens
          </button>
          <button type="button" onClick={onLaunchToken} className="min-h-[40px] cursor-pointer underline underline-offset-4">
            Launch a token
          </button>
        </div>

        {/* Search — hidden on phones, where the global search bar above does the same job */}
        <div className="relative hidden w-full max-w-xl sm:block">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, symbol ($AERO, $NVDAc) or 0x address…"
            className="w-full rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] py-3 pl-11 pr-16 text-sm text-[var(--ink)] shadow-sm outline-none transition placeholder:text-[var(--ink-dim)] focus:border-[var(--brand)]"
          />
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="absolute right-3 top-1/2 flex -translate-y-1/2 cursor-pointer items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[11px] text-[var(--ink-muted)] transition hover:border-[var(--brand)] hover:text-[var(--ink)]"
            title="Open command palette (⌘K)"
          >
            <Command size={11} />
            <span>K</span>
          </button>
        </div>
        </div>
      </PageHero>

      {/* Spotlight strip: top tokens by volume, swipeable */}
      <div className="mx-auto w-full max-w-6xl">
        <SpotlightCarousel tokens={spotlightTokens} onOpenToken={onOpenToken} />
      </div>
    </div>
  );
}
