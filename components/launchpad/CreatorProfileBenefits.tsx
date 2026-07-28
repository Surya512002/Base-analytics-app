"use client";

import { BarChart3, Gift, Rocket, TrendingUp, Zap } from "lucide-react";
import { feeShareLabels, FEE_SHARE_CREATOR_BPS } from "@/lib/launchpad/fee-split";
import { formatPlatformFeeLabel } from "@/lib/constants/launchpad";

const perks = [
  {
    icon: TrendingUp,
    title: `${feeShareLabels().creator} swap fees`,
    detail: `${formatPlatformFeeLabel()} platform fee · ${FEE_SHARE_CREATOR_BPS / 100}% to you on every in-app trade`,
  },
  {
    icon: Rocket,
    title: "$0 B20 launch",
    detail: "Vanity 0xB200… · dual DEX · anti-snipe · vesting metadata",
  },
  {
    icon: Gift,
    title: `${feeShareLabels().referrer} referrals`,
    detail: "Token ?ref= links earn on swaps · stack with Quest XP",
  },
  {
    icon: BarChart3,
    title: "Analytics dashboard",
    detail: "Wallet score, launch calendar, and per-token revenue in one app",
  },
  {
    icon: Zap,
    title: "Instant payouts",
    detail: "No claim step — creator fees land in your wallet on each swap",
  },
];

export default function CreatorProfileBenefits() {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-dim)]">
        Base Analytics creators
      </p>
      <h2 className="mt-1 text-base font-bold text-[var(--ink)]">
        Everything o1 launchpad offers — plus our app extras
      </h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {perks.map((p) => (
          <li
            key={p.title}
            className="flex gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)]">
              <p.icon size={18} className="text-[var(--brand-dark)]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--ink)]">{p.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-muted)]">{p.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
