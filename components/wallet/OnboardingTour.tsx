"use client";

import { useEffect, useState } from "react";
import { BarChart3, CalendarCheck, Layers, Sparkles, X } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";

const TOUR_KEY = "base_onboarding_done_v3";

const STEPS: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tab?: AppTab;
}[] = [
  {
    icon: <Layers size={20} className="text-blue-400" />,
    title: "Welcome, Base user",
    body: "You're on Base — the onchain home for builders, traders, and everyday crypto users. This app turns your wallet into scores, rewards, and real utility.",
  },
  {
    icon: <BarChart3 size={20} className="text-cyan-400" />,
    title: "Your onchain analysis",
    body: "We scan your wallet history — active days, heatmap, rank, volume, and contract activity — all updated from real Base transactions.",
    tab: "dashboard",
  },
  {
    icon: <CalendarCheck size={20} className="text-amber-400" />,
    title: "Daily check-in & quests",
    body: "Earn weekly XP with daily check-ins, boosts, GM/GN, and quests. Start here each day to climb the leaderboard.",
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

  const close = () => {
    localStorage.setItem(TOUR_KEY, "1");
    setOpen(false);
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
      <div className="relative w-full max-w-md elegant-panel rounded-3xl border border-violet-500/30 overflow-hidden tab-content-enter">
        <div className="h-0.5 bg-linear-to-r from-champagne via-violet-400 to-cyan-400" />
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
            <Sparkles size={11} /> Welcome · Step {step + 1}/{STEPS.length}
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
              {step >= STEPS.length - 1 ? "Go to Check-In" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
