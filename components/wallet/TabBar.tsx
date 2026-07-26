import { BarChart3, Flame, Gift, Rocket, Trophy } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";
import type { RewardsHubView } from "@/lib/utils/app-url";
import { isRewardsHubTab } from "@/lib/utils/app-url";

interface TabBarProps {
  tab: AppTab;
  doneQuests: number;
  onTabChange: (tab: AppTab, opts?: { rewardsView?: RewardsHubView }) => void;
  guest?: boolean;
}

export default function TabBar({ tab, doneQuests, onTabChange, guest }: TabBarProps) {
  const tabs = [
    {
      id: "launchpad" as const,
      icon: <Rocket size={14} />,
      label: "Explore",
      featured: true,
    },
    { id: "basehub" as const, icon: <Gift size={14} />, label: "Vouchers" },
    { id: "dashboard" as const, icon: <BarChart3 size={14} />, label: "Analytics" },
    {
      id: "checkin" as const,
      icon: <Flame size={14} />,
      label: `Quests & Rewards${doneQuests > 0 ? ` · ${doneQuests}` : ""}`,
    },
    { id: "achievements" as const, icon: <Trophy size={13} />, label: "Badges" },
  ];

  return (
    <div className="flex glass-panel p-1.5 rounded-2xl mb-4 overflow-x-auto gap-1 no-scrollbar touch-scroll-x shadow-lg shadow-black/20">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`relative flex items-center justify-center gap-1.5 py-2.5 px-3 sm:px-4 rounded-xl font-bold text-[11px] sm:text-xs whitespace-nowrap flex-1 transition-colors duration-200 ${
            tab === t.id || (t.id === "checkin" && isRewardsHubTab(tab))
              ? "tab-active shadow-lg"
              : guest && t.id !== "launchpad"
                ? "text-slate-500 hover:text-slate-300 hover:bg-white/5 opacity-70"
                : "text-slate-400 hover:text-[var(--ink)] hover:bg-[var(--bg-hover)]"
          } ${t.featured && tab !== t.id ? "tab-featured" : ""}`}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
