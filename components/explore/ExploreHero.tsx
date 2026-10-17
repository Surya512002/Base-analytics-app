"use client";

import React, { useState } from "react";
import { Search, Rocket, ChevronDown, Command } from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import SpotlightCarousel from "./SpotlightCarousel";

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
    <div className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-7 lg:p-8 shadow-card">
      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6 lg:gap-8 items-center">
        {/* Left Column: Headline, Subtitle, Integrated Search, 2 Buttons */}
        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[var(--ink)] tracking-tight leading-[1.15]">
              Discover Tokens.{" "}
              <span className="text-[#0052FF]">Swap in App.</span>
            </h1>
            <p className="text-sm sm:text-base text-[var(--ink-muted)] leading-relaxed max-w-xl">
              Live liquidity rails, B20 vanity standards, and Coinbase tokenized equities on Base.
            </p>
          </div>

          {/* ONE Integrated Search Field with visible ⌘K hint */}
          <div className="relative max-w-lg">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, symbol ($AERO, $NVDAc) or 0x address…"
              className="w-full pl-10 pr-16 py-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-dim)] outline-none focus:border-[#0052FF] transition shadow-xs"
            />
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--surface)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[#0052FF] transition cursor-pointer"
              title="Open command palette (⌘K)"
            >
              <Command size={11} />
              <span>K</span>
            </button>
          </div>

          {/* Exactly Two Buttons: "Browse tokens" and "Launch token" */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onBrowseTokens}
              className="btn-primary px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <span>Browse tokens</span>
              <ChevronDown size={16} />
            </button>

            <button
              type="button"
              onClick={onLaunchToken}
              className="px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-sm font-bold text-[var(--ink)] transition cursor-pointer flex items-center gap-2"
            >
              <Rocket size={16} className="text-[#0052FF]" />
              <span>Launch token</span>
            </button>
          </div>
        </div>

        {/* Right Column: ONE Spotlight Card (rotates top 3) */}
        <div>
          <SpotlightCarousel
            tokens={spotlightTokens}
            onOpenToken={onOpenToken}
          />
        </div>
      </div>
    </div>
  );
}
