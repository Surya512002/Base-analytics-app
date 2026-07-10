"use client";

import { ArrowRight, Flame } from "lucide-react";
import type { WalletAppState } from "@/hooks/useWalletApp";

export default function ExploreQuestBanner({
  app,
  onGoQuests,
}: {
  app: WalletAppState;
  onGoQuests?: () => void;
}) {
  const { wallet, txKeys } = app;
  if (!wallet) return null;

  const swapCount = txKeys.swap ?? 0;
  const firstSwapDone = swapCount >= 1;
  if (firstSwapDone && swapCount >= 3) return null;

  const message = !firstSwapDone
    ? "Complete your first in-app swap this week → earn quest XP"
    : "3 swaps this week unlocks bonus DeFi quest XP";

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-linear-to-r from-amber-500/[0.08] to-transparent p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
          <Flame size={18} className="text-amber-300" />
        </div>
        <div>
          <p className="section-eyebrow text-amber-300/90">Weekly quest</p>
          <p className="readable-body text-sm mt-0.5">{message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onGoQuests}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-amber-500/20 border border-amber-500/35 text-[12px] font-bold text-amber-100 hover:bg-amber-500/30 transition-colors"
      >
        View quests <ArrowRight size={14} />
      </button>
    </div>
  );
}
