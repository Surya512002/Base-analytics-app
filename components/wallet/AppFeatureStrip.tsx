import { ArrowLeftRight, Coins, Gift, Rocket } from "lucide-react";
import type { AppTab } from "@/hooks/useWalletApp";

const STRIP: { icon: React.ReactNode; label: string; tab?: AppTab; core?: boolean }[] = [
  { icon: <Coins size={13} className="text-blue-400" />, label: "Tokenized Stocks", tab: "lend", core: true },
  { icon: <Rocket size={13} className="text-emerald-400" />, label: "Token Launchpad", tab: "launchpad", core: true },
  { icon: <ArrowLeftRight size={13} className="text-cyan-400" />, label: "DEX Swap", tab: "swap" },
  { icon: <Gift size={13} className="text-[var(--ink-muted)]" />, label: "Base Vouchers", tab: "basehub" },
];

interface AppFeatureStripProps {
  onNavigate?: (tab: AppTab) => void;
}

export default function AppFeatureStrip({ onNavigate }: AppFeatureStripProps) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 items-center">
      <div className="inline-flex items-center gap-2 badge-live rounded-full px-3 py-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-glow" />
        <span className="text-[9px] font-black uppercase tracking-widest">B20 launchpad live</span>
      </div>
      {STRIP.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => s.tab && onNavigate?.(s.tab)}
          className={`pop-pill glass-panel-accent rounded-full px-3 py-1.5 flex items-center gap-1.5 hover:border-[var(--border-strong)] transition cursor-pointer ${
            s.core ? "border-emerald-500/30" : ""
          }`}
        >
          {s.icon}
          <span className="text-[9px] font-black text-[var(--ink-soft)] uppercase tracking-wide">
            {s.label}
          </span>
          {s.core && (
            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wider">Core</span>
          )}
        </button>
      ))}
    </div>
  );
}
