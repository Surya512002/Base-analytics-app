"use client";

import React from "react";
import { Coins, DollarSign, RefreshCw, type LucideIcon } from "lucide-react";
import PageHero from "@/components/ui/PageHero";

const FACTS: Array<{ icon: LucideIcon; title: string; note: string }> = [
  { icon: DollarSign, title: "$0 launch fee", note: "No platform creation charge" },
  { icon: Coins, title: "0.25% creator revenue", note: "Earned on every DEX swap" },
  { icon: RefreshCw, title: "Instant payouts", note: "Direct to your wallet" },
];

export default function LaunchHeader() {
  return (
    <PageHero
      size="md"
      eyebrow="Base Mainnet Token Factory"
      title={
        <>
          Launch on Base —{" "}
          <span className="text-[var(--brand-text)]">earn on every trade.</span>
        </>
      }
      subtitle="Deploy verified B20 vanity tokens, standard meme coins, or stock-paired tokens with built-in creator revenue sharing."
    >
      <div className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-3">
        {FACTS.map(({ icon: Icon, title, note }) => (
          <div
            key={title}
            className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-left shadow-sm"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)]">
              <Icon size={16} />
            </span>
            <span>
              <span className="block text-sm font-bold text-[var(--ink)]">{title}</span>
              <span className="block text-[11px] text-[var(--ink-muted)]">{note}</span>
            </span>
          </div>
        ))}
      </div>
    </PageHero>
  );
}
