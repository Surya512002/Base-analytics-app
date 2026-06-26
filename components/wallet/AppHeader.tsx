import { Droplets, Power, Zap } from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
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
    <header className="sticky top-0 z-40 bg-[#071220]/92 backdrop-blur-xl border-b border-white/12 shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <AppLogo size="sm" />
          <span className="font-black text-sm sm:text-base text-white truncate tracking-wide">
            BASE<span className="text-cyan-400">.</span>ANALYTICS
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 badge-live rounded-xl px-2.5 py-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_#10b981]" />
            <span className="text-[10px] font-black whitespace-nowrap uppercase tracking-wide text-rose-200">
              x402 Live
            </span>
            <span className="text-rose-300/50 mx-0.5">·</span>
            <span className="text-[10px] text-slate-300">{getDaysLeft()}d</span>
          </div>
          <div className="flex items-center gap-1 glass-panel-accent rounded-xl px-2.5 py-1.5">
            <Zap size={11} className="text-cyan-400" />
            <span className="text-[10px] font-black text-cyan-300">{weeklyXP}</span>
            <span className="text-[9px] text-slate-400 hidden sm:inline">XP</span>
          </div>
          {sponsored > 0 && (
            <div className="hidden sm:flex items-center gap-1 glass-panel rounded-xl px-2.5 py-1.5">
              <Droplets size={11} className="text-cyan-400" />
              <span className="text-[10px] text-cyan-400 font-bold">{sponsored}</span>
            </div>
          )}
          <button
            onClick={onDisconnect}
            className="p-2 glass-panel rounded-xl text-slate-400 hover:text-white hover:border-cyan-400/40 transition-all"
            aria-label="Disconnect wallet"
          >
            <Power size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
