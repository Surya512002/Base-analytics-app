"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Command, Rocket, Search, X } from "lucide-react";

const TOUR_KEY = "base_explore_onboarding_v1";

const STEPS = [
  {
    icon: <Search size={18} className="text-[#6BA3FF]" />,
    title: "Find a token",
    body: "Search by name, symbol, or paste a contract address. Trending and B20 shortcuts get you there fast.",
  },
  {
    icon: <ArrowUpRight size={18} className="text-emerald-400" />,
    title: "Swap in-app",
    body: "Open any token — compare Uniswap vs Aerodrome, use $10 quick-buy presets, and trade without leaving Base Analytics.",
  },
  {
    icon: <Rocket size={18} className="text-violet-400" />,
    title: "Launch B20",
    body: "Creators: vanity 0xB20… addresses, dual-DEX liquidity, and shareable token pages — all on Base.",
  },
];

export default function ExploreOnboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(TOUR_KEY)) {
      if (localStorage.getItem("base_onboarding_done_v5")) {
        localStorage.setItem(TOUR_KEY, "1");
        return;
      }
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem(TOUR_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-4 pointer-events-none">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        onClick={close}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-[#0052FF]/30 bg-[#080808] shadow-2xl pointer-events-auto tab-content-enter overflow-hidden">
        <div className="h-0.5 bg-linear-to-r from-[#0052FF] via-emerald-400 to-violet-400" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              {current.icon}
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-dim)]">
                Explore · {step + 1}/{STEPS.length}
              </p>
            </div>
            <button type="button" onClick={close} className="text-[var(--ink-dim)] hover:text-white">
              <X size={16} />
            </button>
          </div>
          <h3 className="page-hero-title text-xl">{current.title}</h3>
          <p className="readable-body text-sm mt-2">{current.body}</p>
          <div className="flex gap-2 mt-6">
            <button
              type="button"
              onClick={close}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-[var(--ink-muted)]"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => {
                if (step >= STEPS.length - 1) close();
                else setStep((n) => n + 1);
              }}
              className="flex-1 py-2.5 rounded-xl bg-[var(--ink)] text-[#080808] text-sm font-bold"
            >
              {step >= STEPS.length - 1 ? "Start exploring" : "Next"}
            </button>
          </div>
          {step === 0 && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
              className="w-full mt-2 py-2 text-[11px] font-semibold text-[#6BA3FF] flex items-center justify-center gap-1"
            >
              <Command size={12} /> Or press ⌘K
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
