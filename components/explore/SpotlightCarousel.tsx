"use client";

import React, { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, ArrowRight, Sparkles } from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import { formatCompactUsd, formatExactUsd } from "@/lib/explore/explore-config";

interface SpotlightCarouselProps {
  tokens: UnifiedToken[];
  onOpenToken: (token: UnifiedToken) => void;
}

export default function SpotlightCarousel({
  tokens,
  onOpenToken,
}: SpotlightCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const topThree = tokens.slice(0, 3);
  const activeToken = topThree[currentIndex] ?? topThree[0];

  useEffect(() => {
    if (topThree.length <= 1) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % topThree.length);
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [topThree.length, isPaused]);

  if (!activeToken) return null;

  const isUp = activeToken.priceChange24h >= 0;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={() => onOpenToken(activeToken)}
      className="pop-lg group relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 sm:p-5 shadow-card cursor-pointer flex flex-col justify-between"
    >
      {/* Top Accent Ribbon */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0052FF] via-blue-400 to-indigo-500" />

      <div className="space-y-3.5">
        {/* Spotlight Eyebrow & Carousel Dots */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0052FF]/10 text-[#0052FF] text-[10px] font-bold uppercase tracking-wider">
            <Sparkles size={11} />
            <span>Spotlight #{currentIndex + 1}</span>
          </div>

          {/* Dots Indicator */}
          {topThree.length > 1 && (
            <div
              className="flex items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              {topThree.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  data-pop="off"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    currentIndex === idx
                      ? "w-4 bg-[#0052FF]"
                      : "w-1.5 bg-[var(--ink-dim)] hover:bg-[var(--ink-muted)]"
                  }`}
                  aria-label={`Go to spotlight slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Token Identity Row */}
        <div className="flex items-center gap-3">
          {activeToken.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeToken.imageUrl}
              alt=""
              className="w-12 h-12 rounded-xl object-cover border border-[var(--border-subtle)] shrink-0 shadow-xs"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center font-mono font-black text-sm text-[var(--ink)] shrink-0 shadow-xs">
              {activeToken.symbol.slice(0, 3)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-[var(--ink)] truncate group-hover:text-[#0052FF] transition-colors">
                {activeToken.name}
              </h3>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-[var(--surface)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
                {activeToken.type.toUpperCase()}
              </span>
            </div>
            <p className="font-mono text-xs text-[var(--ink-muted)]">${activeToken.symbol}</p>
          </div>
        </div>

        {/* Price & 24h Change Row */}
        <div className="flex items-baseline justify-between pt-1">
          <div>
            <span className="text-[10px] text-[var(--ink-muted)] block">Price</span>
            <span className="text-xl font-mono font-black text-[var(--ink)] tabular-nums">
              {formatExactUsd(activeToken.priceUsd)}
            </span>
          </div>

          <div
            className={`flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-lg ${
              isUp
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
            }`}
          >
            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>
              {isUp ? "+" : ""}
              {activeToken.priceChange24h.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Mini Stats Bar */}
        <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-xs">
          <div>
            <span className="text-[10px] text-[var(--ink-muted)] block">24h Volume</span>
            <span className="font-mono font-bold text-[var(--ink)] tabular-nums">
              {formatCompactUsd(activeToken.volume24h)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-[var(--ink-muted)] block">Liquidity</span>
            <span className="font-mono font-bold text-[var(--ink)] tabular-nums">
              {formatCompactUsd(activeToken.liquidityUsd)}
            </span>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="pt-3 mt-3 border-t border-[var(--border-subtle)]/60 flex items-center justify-between text-xs font-bold text-[#0052FF]">
        <span>Trade now with USD routing</span>
        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
}
