"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Gift, Rocket, Sparkles, Trophy, BarChart3 } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";

const SERVICES: {
  id: string;
  tab?: AppTab;
  label: string;
  desc: string;
  icon: typeof Rocket;
  accent: string;
  href?: string;
}[] = [
  {
    id: "launch",
    tab: "launchpad",
    label: "B20 Launchpad",
    desc: "Create tokens · dual-DEX · 0.5% fees",
    icon: Rocket,
    accent: "from-[#0052FF]/20 to-[#0052FF]/5 border-[#0052FF]/30",
  },
  {
    id: "analytics",
    tab: "dashboard",
    label: "Wallet Analytics",
    desc: "Onchain score · heatmap · portfolio",
    icon: BarChart3,
    accent: "from-cyan-500/15 to-cyan-500/5 border-cyan-500/25",
  },
  {
    id: "vouchers",
    tab: "basehub",
    label: "Crypto Vouchers",
    desc: "Gift USDC & ETH on Base",
    icon: Gift,
    accent: "from-amber-500/15 to-amber-500/5 border-amber-500/25",
  },
  {
    id: "badges",
    tab: "achievements",
    label: "Achievement NFTs",
    desc: "Mint badges · earn XP",
    icon: Trophy,
    accent: "from-violet-500/15 to-violet-500/5 border-violet-500/25",
  },
];

export default function ExploreServicesRail({
  onNavigate,
  guest,
  onConnect,
}: {
  onNavigate: (tab: AppTab) => void;
  guest?: boolean;
  onConnect?: () => void;
}) {
  const click = (tab?: AppTab) => {
    if (guest && tab && tab !== "launchpad") {
      onConnect?.();
      return;
    }
    if (tab) onNavigate(tab);
  };

  return (
    <section className="page-hero overflow-hidden">
      <div className="h-0.5 bg-linear-to-r from-violet-500 via-[#0052FF] to-emerald-400" />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-[#6BA3FF]" />
          <p className="section-eyebrow">Everything in one app</p>
        </div>
        <h3 className="page-hero-title mb-4">Trade, earn &amp; launch on Base</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SERVICES.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => click(s.tab)}
                className={`group text-left rounded-2xl border bg-linear-to-br ${s.accent} p-4 hover:brightness-110 transition-all`}
              >
                <Icon size={18} className="text-white/80 mb-2" />
                <p className="text-sm font-black text-white group-hover:text-[#6BA3FF] transition-colors">
                  {s.label}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{s.desc}</p>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#6BA3FF] mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ArrowUpRight size={10} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
