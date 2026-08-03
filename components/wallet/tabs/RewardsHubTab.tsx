"use client";

import { Flame, Sparkles, Trophy } from "lucide-react";
import CheckInTab from "@/components/wallet/tabs/CheckInTab";
import WeeklyRecapBanner from "@/components/wallet/WeeklyRecapBanner";
import ReferralPanel from "@/components/wallet/ReferralPanel";
import { WEEKLY_QUESTS } from "@/lib/constants/season";
import type { WalletAppState } from "@/hooks/useWalletApp";

export default function RewardsHubTab({ app }: { app: WalletAppState }) {
  const { weeklyXP, doneQuests, streak, wallet } = app;

  return (
    <div className="w-full space-y-5 sm:space-y-6 tab-content-enter">
      <div className="page-hero">
        <div className="accent-bar" />
        <div className="p-5 sm:p-8">
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 xl:gap-10">
            <div className="min-w-0 max-w-2xl">
              <p className="section-eyebrow flex items-center gap-2">
                <Sparkles size={12} className="shrink-0" />
                Season rewards hub
              </p>
              <h1 className="page-hero-title mt-3">Quests &amp; Check-in</h1>
              <p className="readable-body text-sm sm:text-base mt-3 max-w-xl">
                Weekly quests, live rankings, and daily check-ins to earn season XP and points.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full xl:w-auto xl:min-w-[320px] shrink-0">
              <div className="editorial-stat text-center sm:text-left">
                <p className="editorial-stat-label flex items-center justify-center sm:justify-start gap-1">
                  <Trophy size={10} />
                  Weekly XP
                </p>
                <p className="editorial-stat-value">{weeklyXP}</p>
              </div>
              <div className="editorial-stat text-center sm:text-left">
                <p className="editorial-stat-label">Quests</p>
                <p className="editorial-stat-value">{doneQuests}</p>
              </div>
              <div className="editorial-stat text-center sm:text-left">
                <p className="editorial-stat-label flex items-center justify-center sm:justify-start gap-1">
                  <Flame size={10} />
                  Streak
                </p>
                <p className="editorial-stat-value">{streak}d</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <WeeklyRecapBanner
        weeklyXP={weeklyXP}
        doneQuests={doneQuests}
        totalQuests={WEEKLY_QUESTS.length}
        streak={streak}
      />

      {wallet && <ReferralPanel address={wallet.address} />}

      <CheckInTab app={app} embedded />
    </div>
  );
}
