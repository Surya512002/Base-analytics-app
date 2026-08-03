"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Command, Rocket, Search, X } from "lucide-react";
import {
  EXPLORE_TOUR_KEY,
  OPEN_GUIDE_EVENT,
  consumeGuideReplay,
  isExploreTourDone,
  lockBodyScroll,
  markExploreTourDone,
  type GuideKind,
} from "@/lib/utils/onboarding-tour";

const STEPS = [
  {
    icon: <Search size={18} className="text-[var(--ink-muted)]" />,
    title: "Find a token",
    body: "Search by name, symbol, or paste a contract address. Trending and B20 shortcuts get you there fast.",
  },
  {
    icon: <ArrowUpRight size={18} className="text-emerald-600" />,
    title: "Swap in-app",
    body: "Open any token — compare Uniswap vs Aerodrome, use $10 quick-buy presets, and trade without leaving Base Analytics.",
  },
  {
    icon: <Rocket size={18} className="text-[var(--ink-muted)]" />,
    title: "Launch B20",
    body: "Creators: vanity 0xB20… addresses, dual-DEX liquidity, and shareable token pages — all on Base.",
  },
];

export default function ExploreOnboarding({
  forceOpen = false,
}: {
  /** Parent can force-open after “Replay guide”. */
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setOpen(true);
      return;
    }
    if (typeof window === "undefined") return;
    const replay = consumeGuideReplay("explore");
    if (replay === "explore") {
      setStep(0);
      setOpen(true);
      return;
    }
    if (isExploreTourDone()) return;
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [forceOpen]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const which = (e as CustomEvent<{ which?: GuideKind }>).detail?.which;
      if (which && which !== "explore") return;
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_GUIDE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    lockBodyScroll(open);
    return () => lockBodyScroll(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        markExploreTourDone();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    markExploreTourDone();
    setOpen(false);
  };

  if (!open) return null;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-3 sm:p-4 pointer-events-none overflow-y-auto overscroll-contain">
      <div
        className="absolute inset-0 bg-[var(--bg-deep)]/75 backdrop-blur-md pointer-events-auto"
        onClick={close}
      />
      <div
        className="relative w-full max-w-md elegant-panel rounded-3xl border border-[var(--border-strong)] shadow-2xl pointer-events-auto tab-content-enter overflow-hidden my-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Explore guide"
        style={{
          marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
          maxHeight:
            "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 1.5rem)",
        }}
      >
        <div className="h-0.5 bg-[var(--brand)]" />
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain max-h-[inherit]">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              {current.icon}
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-dim)]">
                Explore · {step + 1}/{STEPS.length}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="p-1.5 rounded-lg text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
              aria-label="Close guide"
            >
              <X size={16} />
            </button>
          </div>
          <h3 className="text-xl font-black text-[var(--ink)]">{current.title}</h3>
          <p className="text-sm text-[var(--ink-muted)] mt-2 leading-relaxed">
            {current.body}
          </p>
          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={close}
              className="flex-1 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => {
                if (step >= STEPS.length - 1) close();
                else setStep((n) => n + 1);
              }}
              className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-bold"
            >
              {step >= STEPS.length - 1 ? "Start exploring" : "Next"}
            </button>
          </div>
          {step === 0 && (
            <button
              type="button"
              onClick={() => {
                close();
                window.setTimeout(() => {
                  window.dispatchEvent(new Event("open-command-palette"));
                }, 50);
              }}
              className="w-full mt-2 py-2 text-[11px] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] flex items-center justify-center gap-1"
            >
              <Command size={12} /> Or press ⌘K
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** @deprecated kept for e2e / callers that set the key directly */
export { EXPLORE_TOUR_KEY };
