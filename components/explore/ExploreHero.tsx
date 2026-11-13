"use client";

import React from "react";
import { Search, Command } from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import SpotlightCarousel from "./SpotlightCarousel";
import PageHero from "@/components/ui/PageHero";

interface ExploreHeroProps {
  spotlightTokens: UnifiedToken[];
  onOpenToken: (token: UnifiedToken) => void;
  onBrowseTokens: () => void;
  onLaunchToken: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenCommandPalette: () => void;
}

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
        eyebrow="Explore Base"
        title={
          <>
            Find tokens on Base —{" "}
            <span className="text-[var(--brand-text)]">swap in seconds.</span>
          </>
        }
        subtitle="Live prices, verified tokenized stocks and new launches on Base, all in one place."
        actions={[
          { label: "Browse tokens", onClick: onBrowseTokens, primary: true },
          { label: "Launch token", onClick: onLaunchToken },
        ]}
      >
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
            className="w-full rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] py-3.5 pl-11 pr-16 text-sm text-[var(--ink)] shadow-sm outline-none transition placeholder:text-[var(--ink-dim)] focus:border-[var(--brand)]"
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
      </PageHero>

      {/* Today's spotlight — one calm card under the hero */}
      <div className="mx-auto w-full max-w-xl">
        <SpotlightCarousel tokens={spotlightTokens} onOpenToken={onOpenToken} />
      </div>
    </div>
  );
}
