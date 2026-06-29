import { BarChart3, Gift, Zap } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";

const STRIP: { icon: React.ReactNode; label: string; tab?: AppTab }[] = [
  { icon: <Gift size={13} className="text-cyan-400" />, label: "Base Voucher", tab: "basehub" },
  { icon: <Zap size={13} className="text-amber-400" />, label: "x402 Payments", tab: "dashboard" },
  { icon: <BarChart3 size={13} className="text-rose-400" />, label: "Wallet Analytics", tab: "dashboard" },
];

interface AppFeatureStripProps {
  onNavigate?: (tab: AppTab) => void;
}

export default function AppFeatureStrip({ onNavigate }: AppFeatureStripProps) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 items-center">
      <div className="inline-flex items-center gap-2 badge-live rounded-full px-3 py-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-glow shadow-[0_0_6px_#10b981]" />
        <span className="text-[9px] font-black uppercase tracking-widest">Live on Base</span>
      </div>
      {STRIP.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => s.tab && onNavigate?.(s.tab)}
          className="glass-panel-accent rounded-full px-3 py-1.5 flex items-center gap-1.5 hover:border-cyan-500/40 transition"
        >
          {s.icon}
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-wide">
            {s.label}
          </span>
        </button>
      ))}
    </div>
  );
}
