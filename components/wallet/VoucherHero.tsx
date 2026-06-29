import VoucherGiftCard3D from "@/components/wallet/VoucherGiftCard3D";
import AppLogo from "@/components/ui/AppLogo";
import { Gift, Sparkles, Zap } from "lucide-react";

const STATS = [
  { icon: <Gift size={13} className="text-emerald-400" />, label: "ETH & USDC" },
  { icon: <Zap size={13} className="text-amber-400" />, label: "Gas sponsored" },
  { icon: <Sparkles size={13} className="text-violet-400" />, label: "Up to 50 cards" },
] as const;

export default function VoucherHero() {
  return (
    <div className="relative overflow-hidden glass-panel rounded-3xl border border-violet-500/25 voucher-hero-glow card-shimmer">
      <div className="h-0.5 bg-linear-to-r from-amber-400 via-violet-500 to-cyan-400" />
      <div className="absolute top-0 right-0 w-72 h-72 bg-violet-500/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative grid lg:grid-cols-2 gap-8 lg:gap-10 p-6 sm:p-8 items-center">
        <div className="text-center lg:text-left tab-content-enter">
          <div className="inline-flex items-center gap-2 badge-live rounded-full px-3 py-1.5 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
            <span className="text-[9px] font-black uppercase tracking-widest">Base Voucher Protocol</span>
          </div>

          <p className="text-2xl sm:text-3xl font-black text-white leading-tight">Decentralized</p>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black leading-[1.05] mt-1">
            <span className="text-gradient-prism">Crypto Gift Cards</span>
          </h2>
          <p className="text-xl sm:text-2xl font-black text-white mt-3">
            For anyone,{" "}
            <span className="relative inline-block text-cyan-300">
              anywhere!
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-linear-to-r from-violet-400 via-cyan-400 to-emerald-400 rounded-full" />
            </span>
          </p>
          <p className="text-sm sm:text-base text-slate-400 font-medium leading-relaxed mt-5 max-w-md mx-auto lg:mx-0">
            Create, share, and redeem onchain gift cards on{" "}
            <span className="text-cyan-400 font-bold">Base</span> — from $1 USDC to full ETH batches.
          </p>

          <div className="mt-6 flex flex-wrap gap-2 justify-center lg:justify-start">
            {STATS.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1.5 glass-panel-accent rounded-full px-3 py-1.5 text-[10px] font-black text-slate-300"
              >
                {s.icon}
                {s.label}
              </span>
            ))}
          </div>

          <div className="mt-5 inline-flex items-center gap-2.5 glass-panel-accent rounded-full px-4 py-2.5">
            <AppLogo size="sm" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              Built on Base
            </span>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end py-4 lg:py-0 card-tilt-3d">
          <div className="animate-float">
            <VoucherGiftCard3D asset="USDC" showStack animated />
          </div>
        </div>
      </div>
    </div>
  );
}
