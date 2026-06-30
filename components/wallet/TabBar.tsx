import { BarChart3, Flame, Gift, Trophy, Users } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";

interface TabBarProps {
  tab: AppTab;
  doneQuests: number;
  onTabChange: (tab: AppTab) => void;
}

export default function TabBar({ tab, doneQuests, onTabChange }: TabBarProps) {
  const tabs = [
    { id: "basehub" as const, icon: <Gift size={14} />, label: "Vouchers", featured: true },
    { id: "dashboard" as const, icon: <BarChart3 size={14} />, label: "Analytics" },
    {
      id: "checkin" as const,
      icon: <Flame size={14} />,
      label: `Check-In${doneQuests > 0 ? ` · ${doneQuests}` : ""}`,
    },
    { id: "achievements" as const, icon: <Trophy size={13} />, label: "Badges" },
    { id: "leaderboard" as const, icon: <Users size={13} />, label: "Rankings" },
  ];

  return (
    <div className="flex glass-panel p-1.5 rounded-2xl mb-4 overflow-x-auto gap-1 no-scrollbar touch-scroll-x shadow-lg shadow-black/20">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`relative flex items-center justify-center gap-1.5 py-2.5 px-3 sm:px-4 rounded-xl font-bold text-[11px] sm:text-xs whitespace-nowrap flex-1 transition-colors duration-200 ${
            tab === t.id
              ? "tab-active shadow-lg"
              : "text-slate-400 hover:text-cyan-200 hover:bg-white/8"
          } ${t.featured && tab !== t.id ? "tab-featured" : ""}`}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
