import {
  BarChart3,
  BookOpen,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";

interface TabBarProps {
  tab: AppTab;
  doneQuests: number;
  onTabChange: (tab: AppTab) => void;
}

export default function TabBar({ tab, doneQuests, onTabChange }: TabBarProps) {
  const tabs = [
    { id: "dashboard" as const, icon: <BarChart3 size={13} />, label: "Dashboard" },
    { id: "achievements" as const, icon: <Trophy size={13} />, label: "Badges" },
    {
      id: "quests" as const,
      icon: <Target size={13} />,
      label: `Quests${doneQuests > 0 ? ` · ${doneQuests}` : ""}`,
    },
    { id: "leaderboard" as const, icon: <Users size={13} />, label: "Rankings" },
    { id: "basehub" as const, icon: <BookOpen size={13} />, label: "Ecosystem" },
  ];

  return (
    <div className="flex glass-panel p-1 rounded-2xl mb-5 overflow-x-auto gap-0.5 no-scrollbar">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 sm:px-4 rounded-xl font-bold text-[11px] sm:text-xs whitespace-nowrap flex-1 transition-all ${
            tab === t.id
              ? "tab-active shadow-lg"
              : "text-slate-400 hover:text-cyan-200 hover:bg-white/8"
          }`}
        >
          {t.icon}
          <span className="hidden sm:inline">{t.label}</span>
          <span className="sm:hidden">{t.label.split(" ")[0]}</span>
        </button>
      ))}
    </div>
  );
}
