"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowLeftRight, Gift, Rocket, Sparkles, Trophy, BarChart3 } from "lucide-react";
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
    accent: "bg-[var(--bg-elevated)] border-[var(--border-subtle)]",
  },
  {
    id: "swap",
    tab: "swap",
    label: "Swap",
    desc: "DEX swap · any Base token",
    icon: ArrowLeftRight,
    accent: "bg-[var(--bg-elevated)] border-[var(--border-subtle)]",
  },
  {
    id: "analytics",
    tab: "dashboard",
    label: "Wallet Analytics",
    desc: "Onchain score · heatmap · portfolio",
    icon: BarChart3,
    accent: "bg-[var(--bg-elevated)] border-[var(--border-subtle)]",
  },
  {
    id: "vouchers",
    tab: "basehub",
    label: "Crypto Vouchers",
    desc: "Gift USDC & ETH on Base",
    icon: Gift,
    accent: "bg-[var(--bg-elevated)] border-[var(--border-subtle)]",
  },
  {
    id: "badges",
    tab: "achievements",
    label: "Achievement NFTs",
    desc: "Mint badges · earn XP",
    icon: Trophy,
    accent: "bg-[var(--bg-elevated)] border-[var(--border-subtle)]",
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
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-[var(--ink-muted)]" />
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
                className={`group text-left rounded-2xl border ${s.accent} p-4 hover:border-[var(--border-strong)] transition-colors`}
              >
                <Icon size={18} className="text-[var(--ink-muted)] mb-2" />
                <p className="text-sm font-black text-[var(--ink)] group-hover:text-[var(--ink)] transition-colors">
                  {s.label}
                </p>
                <p className="text-[10px] text-[var(--ink-muted)] mt-1 leading-snug">{s.desc}</p>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[var(--ink-muted)] mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
