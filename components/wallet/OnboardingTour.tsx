"use client";

import { useEffect, useState } from "react";
import { BarChart3, Sparkles, TrendingUp, Trophy, X } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";

const TOUR_KEY = "base_onboarding_done_v4";

const STEPS: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tab?: AppTab;
}[] = [
  {
    icon: <TrendingUp size={20} className="text-emerald-400" />,
    title: "Welcome to the prediction market",
    body: "Trade BTC, ETH & SOL on hourly, 4h & daily rounds. Live YES/NO odds from a real AMM — like Polymarket, built on Base.",
    tab: "predictions",
  },
  {
    icon: <Trophy size={20} className="text-amber-400" />,
    title: "Earn XP by trading",
    body: "Every prediction trade earns activity points toward your daily cap and weekly quests. The more you trade, the higher you climb the leaderboard.",
    tab: "predictions",
  },
  {
    icon: <BarChart3 size={20} className="text-cyan-400" />,
    title: "Plus wallet analytics & rewards",
    body: "Check in daily, complete quests, mint badges, and use vouchers — all from the same app. Predictions are the core; everything else supports your onchain journey.",
    tab: "checkin",
  },
];

interface OnboardingTourProps {
  onNavigate: (tab: AppTab) => void;
}

export default function OnboardingTour({ onNavigate }: OnboardingTourProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(TOUR_KEY)) {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (open) onNavigate(STEPS[step].tab ?? "predictions");
  }, [open, step, onNavigate]);

  const close = () => {
    localStorage.setItem(TOUR_KEY, "1");
    setOpen(false);
    onNavigate("predictions");
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
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#020608]/80 backdrop-blur-md" onClick={close} />
      <div className="relative w-full max-w-md elegant-panel rounded-3xl border border-emerald-500/30 overflow-hidden tab-content-enter">
        <div className="h-0.5 bg-linear-to-r from-emerald-500 via-cyan-400 to-violet-400" />
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 p-2 rounded-xl bg-white/10 text-slate-400 hover:text-white z-10"
          aria-label="Close tour"
        >
          <X size={16} />
        </button>
        <div className="p-6 pt-8">
          <p className="section-eyebrow flex items-center gap-2">
            <Sparkles size={11} /> Predictions · Step {step + 1}/{STEPS.length}
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
              {step >= STEPS.length - 1 ? "Start trading →" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
