import { ArrowLeftRight, Coins, Gift, Rocket } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";

interface TabBarProps {
  tab: AppTab;
  doneQuests?: number;
  onTabChange: (tab: AppTab) => void;
  guest?: boolean;
}

export default function TabBar({ tab, onTabChange, guest }: TabBarProps) {
  const tabs = [
    {
      id: "launchpad" as const,
      icon: <Rocket size={14} />,
      label: "Explore",
      featured: true,
    },
    { id: "swap" as const, icon: <ArrowLeftRight size={14} />, label: "Swap" },
    { id: "lend" as const, icon: <Coins size={14} />, label: "Lend & Stake" },
    { id: "basehub" as const, icon: <Gift size={14} />, label: "Vouchers" },
  ];

  return (
    <div className="flex glass-panel p-1.5 rounded-2xl mb-4 overflow-x-auto gap-1 no-scrollbar touch-scroll-x shadow-lg shadow-black/20">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`relative flex items-center justify-center gap-1.5 py-2.5 px-3 sm:px-4 rounded-xl font-bold text-[11px] sm:text-xs whitespace-nowrap flex-1 transition-colors duration-200 cursor-pointer ${
            tab === t.id
              ? "tab-active shadow-lg"
              : guest && t.id !== "launchpad" && t.id !== "swap" && t.id !== "lend"
                ? "text-[var(--ink-dim)] hover:text-[var(--ink-muted)] hover:bg-[var(--bg-hover)] opacity-70"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--bg-hover)]"
          } ${t.featured && tab !== t.id ? "tab-featured" : ""}`}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

