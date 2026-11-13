"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Flame,
  TrendingUp,
  Sparkles,
  Landmark,
  ArrowRight,
  Rocket,
  Pause,
  Play,
  type LucideIcon,
} from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import TokenCard from "./TokenCard";
import { EXPLORE_CONFIG } from "@/lib/explore/explore-config";
import ActivePill from "@/components/ui/motion/ActivePill";

export type DiscoveryTab = "trending" | "gainers" | "new" | "stocks";

const TABS: Array<{ id: DiscoveryTab; label: string; icon: LucideIcon; tint: string }> = [
  { id: "trending", label: "Trending", icon: Flame, tint: "text-amber-500" },
  { id: "gainers", label: "Top Gainers", icon: TrendingUp, tint: "text-emerald-500" },
  { id: "new", label: "New Launches", icon: Sparkles, tint: "text-purple-500" },
  { id: "stocks", label: "Stocks", icon: Landmark, tint: "text-[var(--brand-text)]" },
];

/** How long each section stays on screen before the slideshow moves on. */
const SLIDE_MS = 6000;

interface DiscoveryHubProps {
  trendingTokens: UnifiedToken[];
  topMoversTokens: UnifiedToken[];
  recentlyLaunchedTokens: UnifiedToken[];
  stockTokens: UnifiedToken[];
  onTrade: (token: UnifiedToken) => void;
  onSelect?: (token: UnifiedToken) => void;
  onToggleWatch?: (token: UnifiedToken) => void;
  watchlist?: string[];
  moversHideLowLiquidity: boolean;
  onToggleLowLiquidity: () => void;
  onLaunch?: () => void;
  onViewAllCategory: (category: DiscoveryTab) => void;
}

export default function DiscoveryHub({
  trendingTokens,
  topMoversTokens,
  recentlyLaunchedTokens,
  stockTokens,
  onTrade,
  onSelect,
  onToggleWatch,
  watchlist = [],
  moversHideLowLiquidity,
  onToggleLowLiquidity,
  onLaunch,
  onViewAllCategory,
}: DiscoveryHubProps) {
  const [activeTab, setActiveTab] = useState<DiscoveryTab>("trending");
  const reduceMotion = useReducedMotion();

  // Slideshow: on by default, and the pause button turns it off. It also holds while the
  // pointer or keyboard focus is inside the section, and while the section is off screen.
  const [autoplay, setAutoplay] = useState(true);
  const [holding, setHolding] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const running = autoplay && !holding && onScreen;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => {
      if (document.hidden) return;
      setActiveTab((cur) => TABS[(TABS.findIndex((x) => x.id === cur) + 1) % TABS.length].id);
    }, SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [running, activeTab]);

  // On narrow screens the tab row scrolls sideways: keep the active tab in view (row only,
  // never the page).
  const tabListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = tabListRef.current;
    const btn = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !btn || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({
      left: btn.offsetLeft - (list.clientWidth - btn.offsetWidth) / 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [activeTab, reduceMotion]);

  const pickTab = useCallback((id: DiscoveryTab) => {
    setActiveTab(id);
    setAutoplay(false); // the user chose a section, so stop moving it under them
  }, []);

  const tabConfig = {
    trending: {
      title: "Trending on Base",
      description: "Highest 24h trading volume and community DEX activity.",
      tokens: trendingTokens,
      badge: `${trendingTokens.length} active`,
    },
    gainers: {
      title: "Top Gainers & Movers",
      description: "Largest upward price momentum over the last 24 hours.",
      tokens: topMoversTokens,
      badge: `${topMoversTokens.length} movers`,
    },
    new: {
      title: "Recently Launched",
      description: "Latest tokens deployed on Base mainnet with liquidity lockers.",
      tokens: recentlyLaunchedTokens,
      badge: `${recentlyLaunchedTokens.length} tokens`,
    },
    stocks: {
      title: "Tokenized US Stocks",
      description: "Coinbase B20 equities backed 1:1 by custodial shares on Base.",
      tokens: stockTokens,
      badge: `${stockTokens.length} stocks`,
    },
  };

  const current = tabConfig[activeTab];
  const displayTokens = current.tokens.slice(0, EXPLORE_CONFIG.DISCOVERY_ROW_MAX_ITEMS);

  return (
    <section
      ref={sectionRef}
      aria-roledescription="carousel"
      aria-label="Discover tokens"
      onPointerEnter={() => setHolding(true)}
      onPointerLeave={() => setHolding(false)}
      onFocusCapture={() => setHolding(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHolding(false);
      }}
      className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-6 shadow-xs space-y-4 transition-all"
    >
      {/* 1. SECTION SWITCHER: big pills; the active one fills blue and shows the slideshow timer */}
      <div className="space-y-4 pb-4 border-b border-[var(--border-subtle)]/70">
        <div className="flex items-center gap-2">
          <div
            ref={tabListRef}
            role="tablist"
            aria-label="Token sections"
            className="flex flex-1 min-w-0 items-center gap-1.5 overflow-x-auto rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1.5 no-scrollbar"
          >
            {TABS.map(({ id, label, icon: Icon, tint }) => {
              const selected = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => pickTab(id)}
                  className={`relative isolate flex min-h-[46px] flex-none sm:flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-4 text-sm font-bold transition-colors sm:px-5 sm:text-base ${
                    selected
                      ? "text-white"
                      : "text-[var(--ink-muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                  }`}
                >
                  {selected && (
                    <ActivePill
                      layoutId="discovery-tab-pill"
                      className="bg-[var(--brand)] shadow-md shadow-[var(--brand)]/30"
                    />
                  )}
                  <Icon size={18} className={selected ? "text-white" : tint} aria-hidden />
                  <span>{label}</span>
                  {selected && running && !reduceMotion && (
                    <motion.span
                      key={`timer-${id}`}
                      aria-hidden
                      className="absolute bottom-0 left-0 h-[3px] bg-white/70"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: SLIDE_MS / 1000, ease: "linear" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setAutoplay((v) => !v)}
            aria-label={autoplay ? "Pause slideshow" : "Play slideshow"}
            title={autoplay ? "Pause slideshow" : "Play slideshow"}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            {autoplay ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>

        <div aria-live={running ? "off" : "polite"}>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-black text-[var(--ink)] tracking-tight">{current.title}</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
              {current.badge}
            </span>
          </div>
          <p className="text-sm text-[var(--ink-muted)] mt-0.5">{current.description}</p>
        </div>
      </div>

      {/* 2. ACTION STRIP (Liquidity Filter Toggle + View All in Explorer) */}
      <div className="flex items-center justify-between text-xs pt-0.5">
        <div>
          {activeTab === "gainers" && (
            <label className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={moversHideLowLiquidity}
                onChange={onToggleLowLiquidity}
                className="rounded border-[var(--border-subtle)] text-[#0052FF] accent-[#0052FF] focus:ring-0 cursor-pointer"
              />
              <span>Hide &lt; $10K liquidity</span>
            </label>
          )}
        </div>

        <button
          type="button"
          onClick={() => onViewAllCategory(activeTab)}
          className="pop-pill text-xs font-bold text-[var(--brand-text)] px-3 py-1 rounded-xl border border-[var(--brand)]/20 bg-[var(--brand-soft)] flex items-center gap-1 cursor-pointer transition hover:border-[var(--brand)] ml-auto"
        >
          <span>View all {activeTab} in Explorer</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* 3. TOKEN CARDS: slide in from the right on every section change */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {displayTokens.length === 0 ? (
            <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 text-xs">
              <span className="text-[var(--ink-muted)]">No tokens found in this section yet.</span>
              {activeTab === "new" && onLaunch && (
                <button
                  type="button"
                  onClick={onLaunch}
                  className="px-3 py-1.5 rounded-xl bg-[#0052FF] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer hover:opacity-95"
                >
                  <Rocket size={13} />
                  <span>Launch First Token</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 max-sm:flex max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory max-sm:py-2 max-sm:-my-2 max-sm:px-1 max-sm:-mx-1 no-scrollbar">
              {displayTokens.map((token) => (
                <div key={token.id} className="max-sm:min-w-[280px] max-sm:snap-start">
                  <TokenCard
                    token={token}
                    onTrade={onTrade}
                    onSelect={onSelect}
                    onToggleWatch={onToggleWatch}
                    isWatched={watchlist.includes(token.address.toLowerCase())}
                  />
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
