"use client";

import { ArrowRight, Lightbulb } from "lucide-react";
import { buildScoreImprovementTips, type ScoreTip } from "@/lib/wallet/score-tips";
import type { WalletData } from "@/lib/types/wallet";
import type { AppTab } from "@/hooks/useWalletApp";

const ACTION_TAB: Record<ScoreTip["action"], AppTab> = {
  checkin: "checkin",
  swap: "swap",
  launch: "launchpad",
  basename: "dashboard",
  badge: "achievements",
  voucher: "basehub",
  streak: "checkin",
};

function impactClass(impact: string): string {
  const i = impact.toLowerCase();
  if (i.includes("high") || i.includes("basename") || i.includes("quest")) {
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }
  if (i.includes("medium")) {
    return "text-emerald-700 bg-emerald-50/80 border-emerald-100";
  }
  return "text-teal-700 bg-teal-50 border-teal-100";
}

export default function ScoreImprovementTips({
  wallet,
  onNavigate,
}: {
  wallet: WalletData;
  onNavigate: (tab: AppTab, questId?: string) => void;
}) {
  const tips = buildScoreImprovementTips(wallet);
  if (!tips.length) return null;

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb size={16} className="text-amber-500" />
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--ink-muted)]">
          Improve your score
        </p>
      </div>
      <div className="space-y-2">
        {tips.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              onNavigate(
                ACTION_TAB[t.action],
                t.action === "swap" ? "q_swap_first" : undefined
              )
            }
            className="w-full text-left rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-3 hover:border-[var(--border-strong)] hover:bg-[var(--surface)] transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--ink)] group-hover:text-[var(--brand-dark)]">
                  {t.title}
                </p>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5 leading-relaxed">
                  {t.detail}
                </p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${impactClass(t.impact)}`}
              >
                {t.impact}
              </span>
            </div>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onNavigate("launchpad")}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--brand-dark)]"
      >
        Explore actions <ArrowRight size={12} />
      </button>
    </section>
  );
}
