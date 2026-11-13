"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Sparkles } from "lucide-react";
import type { UnifiedToken } from "@/lib/explore/explore-types";
import { formatCompactUsd, formatExactUsd } from "@/lib/explore/explore-config";
import TokenAvatar from "@/components/ui/TokenAvatar";
import VerifiedBadge from "@/components/ui/VerifiedBadge";

interface SpotlightCarouselProps {
  tokens: UnifiedToken[];
  onOpenToken: (token: UnifiedToken) => void;
}

/** Time each step of the auto-slide waits. */
const STEP_MS = 3500;

/**
 * Spotlight strip: small token cards side by side (5 across on desktop), in a scroll-snap
 * track. Swipe either way on touch, drag with the mouse, or use the arrows; it also slides on
 * its own and pauses while the pointer or focus is inside it.
 */
export default function SpotlightCarousel({ tokens, onOpenToken }: SpotlightCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [holding, setHolding] = useState(false);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const cardStep = useCallback(() => {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return 0;
    const gap = parseFloat(getComputedStyle(track).columnGap || "0") || 0;
    return first.offsetWidth + gap;
  }, []);

  const scrollByCards = useCallback(
    (dir: 1 | -1) => {
      const track = trackRef.current;
      if (!track) return;
      const max = track.scrollWidth - track.clientWidth;
      const atEnd = track.scrollLeft >= max - 4;
      const atStart = track.scrollLeft <= 4;
      // Wrap around at the ends so the strip keeps moving.
      const left = dir === 1 && atEnd ? 0 : dir === -1 && atStart ? max : track.scrollLeft + dir * cardStep();
      track.scrollTo({ left, behavior: reduceMotion ? "auto" : "smooth" });
    },
    [cardStep, reduceMotion]
  );

  // Dots: one per "page" of visible cards.
  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const step = cardStep() || 1;
    const perView = Math.max(1, Math.round(track.clientWidth / step));
    const total = Math.max(1, Math.ceil(tokens.length / perView));
    setPages(total);
    const max = track.scrollWidth - track.clientWidth;
    setPage(max <= 0 ? 0 : Math.min(total - 1, Math.round((track.scrollLeft / max) * (total - 1))));
  }, [cardStep, tokens.length]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    if (holding || reduceMotion || tokens.length <= 1) return;
    const t = window.setInterval(() => {
      if (!document.hidden) scrollByCards(1);
    }, STEP_MS);
    return () => window.clearInterval(t);
  }, [holding, reduceMotion, tokens.length, scrollByCards]);

  // Mouse drag (touch already scrolls natively).
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !trackRef.current) return;
    drag.current = { x: e.clientX, left: trackRef.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const track = trackRef.current;
    if (!d || !track) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 5) {
      d.moved = true;
      track.style.scrollSnapType = "none";
      track.style.scrollBehavior = "auto";
    }
    if (d.moved) track.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    const d = drag.current;
    const track = trackRef.current;
    drag.current = null;
    if (!d?.moved || !track) return;
    track.style.scrollSnapType = "";
    track.style.scrollBehavior = "";
    const step = cardStep() || 1;
    track.scrollTo({ left: Math.round(track.scrollLeft / step) * step, behavior: "smooth" });
    // Swallow the click that follows a drag so it doesn't open a token.
    const block = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    track.addEventListener("click", block, { capture: true, once: true });
    window.setTimeout(() => track.removeEventListener("click", block, { capture: true }), 50);
  };

  if (tokens.length === 0) return null;

  return (
    <div
      className="w-full"
      aria-roledescription="carousel"
      aria-label="Spotlight tokens"
      onPointerEnter={() => setHolding(true)}
      onPointerLeave={() => {
        setHolding(false);
        endDrag();
      }}
      onFocusCapture={() => setHolding(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHolding(false);
      }}
    >
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--brand-text)]">
          <Sparkles size={11} />
          Spotlight · top volume
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollByCards(-1)}
            aria-label="Previous tokens"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollByCards(1)}
            aria-label="Next tokens"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 no-scrollbar select-none [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)] sm:cursor-grab sm:active:cursor-grabbing"
      >
        {tokens.map((token, i) => {
          const up = token.priceChange24h >= 0;
          return (
            <button
              key={token.id}
              type="button"
              onClick={() => onOpenToken(token)}
              aria-label={`${token.name}, ${formatExactUsd(token.priceUsd)}`}
              className="group flex w-[calc((100%-12px)/2)] shrink-0 snap-start cursor-pointer flex-col gap-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand)]/50 hover:shadow-md sm:w-[calc((100%-36px)/4)] lg:w-[calc((100%-48px)/5)]"
            >
              <div className="flex items-center gap-2">
                <TokenAvatar
                  src={token.imageUrl}
                  address={token.address}
                  symbol={token.symbol}
                  className="h-8 w-8 shrink-0 rounded-full"
                  textClassName="text-[10px]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm font-bold text-[var(--ink)] group-hover:text-[var(--brand-text)]">
                      {token.symbol}
                    </span>
                    {token.isVerified && <VerifiedBadge size={12} />}
                  </div>
                  <span className="block truncate text-[11px] text-[var(--ink-muted)]">{token.name}</span>
                </div>
                <span className="text-[10px] font-bold text-[var(--ink-dim)]">#{i + 1}</span>
              </div>

              <div className="flex items-end justify-between gap-2">
                <span className="truncate font-mono text-base font-black tabular-nums text-[var(--ink)]">
                  {formatExactUsd(token.priceUsd)}
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[11px] font-bold ${
                    up
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  }`}
                >
                  {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {up ? "+" : ""}
                  {token.priceChange24h.toFixed(1)}%
                </span>
              </div>

              <div className="flex justify-between text-[11px] text-[var(--ink-muted)]">
                <span>
                  Vol <b className="font-mono text-[var(--ink)]">{formatCompactUsd(token.volume24h)}</b>
                </span>
                <span>
                  Liq <b className="font-mono text-[var(--ink)]">{formatCompactUsd(token.liquidityUsd)}</b>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {Array.from({ length: pages }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === page ? "w-4 bg-[var(--brand)]" : "w-1.5 bg-[var(--ink-dim)]/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
