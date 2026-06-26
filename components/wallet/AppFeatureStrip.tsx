import { BarChart3, Gift, Zap } from "lucide-react";

const STRIP = [
  { icon: <Zap size={13} className="text-amber-400" />, label: "x402 · Decentralized" },
  { icon: <Gift size={13} className="text-cyan-400" />, label: "Crypto Gift Cards" },
  { icon: <BarChart3 size={13} className="text-rose-400" />, label: "Onchain Analysis" },
] as const;

export default function AppFeatureStrip() {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <div className="inline-flex items-center gap-2 badge-live rounded-full px-3 py-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-glow shadow-[0_0_6px_#10b981]" />
        <span className="text-[9px] font-black uppercase tracking-widest">Live on Base</span>
      </div>
      {STRIP.map((s) => (
        <div
          key={s.label}
          className="glass-panel-accent rounded-full px-3 py-1.5 flex items-center gap-1.5"
        >
          {s.icon}
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-wide">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}
