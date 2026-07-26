"use client";

import { ArrowRight, Lightbulb } from "lucide-react";
import { buildScoreImprovementTips, type ScoreTip } from "@/lib/wallet/score-tips";
import type { WalletData } from "@/lib/types/wallet";
import type { AppTab } from "@/hooks/useWalletApp";

const ACTION_TAB: Record<ScoreTip["action"], AppTab> = {
  checkin: "checkin",
  swap: "launchpad",
  launch: "launchpad",
  basename: "dashboard",
  badge: "achievements",
  voucher: "basehub",
  streak: "checkin",
};

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
    <section className="page-hero">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb size={16} className="text-amber-300" />
        <p className="section-eyebrow text-amber-300/90">Improve your score</p>
      </div>
      <div className="space-y-2">
        {tips.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              onNavigate(ACTION_TAB[t.action], t.action === "swap" ? "q_swap_first" : undefined)
            }
            className="w-full text-left rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 hover:border-[var(--border-strong)] transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white group-hover:text-[#6BA3FF]">
                  {t.title}
                </p>
                <p className="readable-body text-xs mt-0.5">{t.detail}</p>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-emerald-300 uppercase">
                {t.impact}
              </span>
            </div>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onNavigate("launchpad")}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#6BA3FF]"
      >
        Explore actions <ArrowRight size={12} />
      </button>
    </section>
  );
}
