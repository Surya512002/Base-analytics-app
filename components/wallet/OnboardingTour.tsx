"use client";

import { useEffect, useState } from "react";
import { BarChart3, Rocket, Sparkles, Trophy, X } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";

const TOUR_KEY = "base_onboarding_done_v6";

const STEPS: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tab?: AppTab;
}[] = [
  {
    icon: <Rocket size={20} className="text-emerald-400" />,
    title: "Explore & trade on Base",
    body: "Search tokens, compare Uniswap vs Aerodrome routes, and swap without leaving the app.",
    tab: "launchpad",
  },
  {
    icon: <BarChart3 size={20} className="text-[var(--ink-muted)]" />,
    title: "Your onchain score",
    body: "Analytics shows your score, heatmap, improvement tips, and shareable challenge links.",
    tab: "dashboard",
  },
  {
    icon: <Trophy size={20} className="text-amber-400" />,
    title: "Quests & weekly XP",
    body: "Check in daily, complete weekly quests from swaps and launches, and climb rankings.",
    tab: "checkin",
  },
  {
    icon: <Sparkles size={20} className="text-[var(--ink-muted)]" />,
    title: "Gift crypto with vouchers",
    body: "Create USDC or ETH gift cards on Base — share a link and recipients redeem in one tap.",
    tab: "basehub",
  },
];

interface OnboardingTourProps {
  onNavigate: (tab: AppTab) => void;
  /** Wait until real wallet metrics are loaded before showing the tour. */
  ready?: boolean;
}

export default function OnboardingTour({ onNavigate, ready = false }: OnboardingTourProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (typeof window !== "undefined" && !localStorage.getItem(TOUR_KEY)) {
      setOpen(true);
    }
  }, [ready]);

  useEffect(() => {
    if (open) onNavigate(STEPS[step].tab ?? "launchpad");
  }, [open, step, onNavigate]);

  const close = () => {
    localStorage.setItem(TOUR_KEY, "1");
    setOpen(false);
    onNavigate("launchpad");
  };

  const next = () => {
    const s = STEPS[step];
    if (s.tab) onNavigate(s.tab);
    if (step >= STEPS.length - 1) {
      close();
      return;
    }
    setStep((n) => n + 1);
  };

  if (!open) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
      <div className="absolute inset-0 bg-[var(--bg-deep)]/80 backdrop-blur-md" onClick={close} />
      <div
        className="relative w-full max-w-md elegant-panel rounded-3xl border border-[var(--border-strong)] overflow-hidden tab-content-enter my-auto"
        style={{
          marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
          maxHeight:
            "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 1.5rem)",
        }}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 p-2 rounded-xl bg-white/10 text-slate-400 hover:text-white z-10"
          aria-label="Close tour"
        >
          <X size={16} />
        </button>
        <div className="p-5 pt-8 sm:p-6 sm:pt-8 overflow-y-auto overscroll-contain max-h-[inherit]">
          <p className="section-eyebrow flex items-center gap-2">
            <Sparkles size={11} /> Launchpad · Step {step + 1}/{STEPS.length}
          </p>
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mt-4 mb-4">
            {current.icon}
          </div>
          <h2 className="text-xl font-black text-white">{current.title}</h2>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">{current.body}</p>
          <div className="flex gap-2 mt-6">
            <button type="button" onClick={close} className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-500">
              Skip
            </button>
            <button type="button" onClick={next} className="flex-1 py-3 rounded-xl text-sm font-black btn-primary">
              {step >= STEPS.length - 1 ? "Start launching →" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
