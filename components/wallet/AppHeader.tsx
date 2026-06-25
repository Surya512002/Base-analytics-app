import { Droplets, Hexagon, Power, Zap } from "lucide-react";
import { SEASON_NAME } from "@/lib/constants/season";
import { getDaysLeft } from "@/lib/utils/season";

interface AppHeaderProps {
  weeklyXP: number;
  sponsored: number;
  onDisconnect: () => void;
}

export default function AppHeader({
  weeklyXP,
  sponsored,
  onDisconnect,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#0a0f1e]/95 backdrop-blur-xl border-b border-blue-500/15">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40 shrink-0">
            <Hexagon size={16} className="text-white" />
          </div>
          <span className="font-black text-sm sm:text-base text-white truncate">
            BASE<span className="text-blue-400">.</span>ANALYTICS
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 bg-blue-950/60 border border-blue-500/20 rounded-xl px-2.5 py-1.5">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-blue-300 whitespace-nowrap">
              {SEASON_NAME}
            </span>
            <span className="text-blue-700 mx-0.5">·</span>
            <span className="text-[10px] text-blue-400/50">
              {getDaysLeft()}d
            </span>
          </div>
          <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 rounded-xl px-2.5 py-1.5">
            <Zap size={11} className="text-blue-400" />
            <span className="text-[10px] font-black text-blue-300">
              {weeklyXP}
            </span>
            <span className="text-[9px] text-blue-500 hidden sm:inline">
              XP
            </span>
          </div>
          {sponsored > 0 && (
            <div className="hidden sm:flex items-center gap-1 bg-blue-500/8 border border-blue-500/15 rounded-xl px-2.5 py-1.5">
              <Droplets size={11} className="text-blue-400" />
              <span className="text-[10px] text-blue-400 font-bold">
                {sponsored}
              </span>
            </div>
          )}
          <button
            onClick={onDisconnect}
            className="p-2 bg-blue-950/60 border border-blue-700/30 rounded-xl text-blue-400/60 hover:text-white hover:border-blue-500/40 transition-all"
          >
            <Power size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
