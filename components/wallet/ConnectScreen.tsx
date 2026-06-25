import {
  ChevronRight,
  Droplets,
  Hexagon,
  RefreshCcw,
  Star,
  Target,
  Trophy,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { PAYMASTER_URL } from "@/lib/constants/env";
import { ACHIEVEMENTS, SEASON_NAME, WEEKLY_QUESTS } from "@/lib/constants/season";
import { getDaysLeft, getSeasonPct } from "@/lib/utils/season";
import type { ConnectionType } from "@/lib/types/wallet";

interface ConnectScreenProps {
  loading: boolean;
  scanProgress: string;
  showModal: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
  onConnect: (type: ConnectionType) => void;
}

function HeroTeaser() {
  const tiers = [
    { e: "🦐", l: "Shrimp", active: false },
    { e: "🐬", l: "Dolphin", active: false },
    { e: "🦈", l: "Shark", active: false },
    { e: "🐋", l: "Whale", active: false },
    { e: "👑", l: "God", active: true },
  ];

  return (
    <div className="relative w-full max-w-[360px] mx-auto lg:mx-0">
      <div className="absolute -inset-1 bg-linear-to-r from-cyan-500/20 via-cyan-500/20 to-rose-500/20 rounded-3xl blur-xl" />
      <div className="relative glass-panel rounded-3xl p-6 border border-cyan-500/20 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl" />
        <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.35em] mb-2">
          What&apos;s your rank?
        </p>
        <p className="text-6xl font-black text-white leading-none tracking-tighter mb-1">
          <span className="text-gradient-blue">?</span>
        </p>
        <p className="text-slate-400 text-sm font-medium mb-6">
          Connect & discover your onchain tier on Base
        </p>
        <div className="space-y-1.5">
          {tiers.map((t) => (
            <div
              key={t.l}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                t.active
                  ? "bg-linear-to-r from-blue-600/30 to-cyan-500/10 border border-cyan-500/30"
                  : "opacity-40"
              }`}
            >
              <span className="text-xl">{t.e}</span>
              <span className={`text-sm font-bold ${t.active ? "text-white" : "text-slate-500"}`}>
                {t.l}
              </span>
              {t.active && (
                <span className="ml-auto text-[9px] font-black text-cyan-400 uppercase">You?</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {["⛽ Gasless", "🏅 11 Badges", "⚡ XP"].map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-bold text-slate-400 bg-white/5 border border-white/8 rounded-full px-3 py-1"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ConnectScreen({
  loading,
  scanProgress,
  showModal,
  onOpenModal,
  onCloseModal,
  onConnect,
}: ConnectScreenProps) {
  return (
    <div className="min-h-screen bg-[#00040d] flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      <div className="absolute inset-0 bg-grid-future opacity-30 pointer-events-none" />
      <div
        className="absolute top-0 right-0 w-[700px] h-[450px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(0,229,255,0.15) 0%, transparent 65%)" }}
      />
      <div
        className="absolute bottom-0 left-0 w-[550px] h-[400px] rounded-full blur-[110px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,51,102,0.12) 0%, transparent 65%)" }}
      />

      <div className="relative z-10 w-full max-w-5xl">
        <div className="flex items-center gap-3 mb-8 lg:mb-12">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center glow-ring"
            style={{ background: "linear-gradient(135deg, #0052FF, #00E5FF)" }}
          >
            <Hexagon size={22} className="text-white" />
          </div>
          <span className="font-black text-lg sm:text-xl text-white tracking-[0.2em] uppercase">
            Base Analytics
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* LEFT — Hero */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 badge-live rounded-full px-4 py-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse-glow shadow-[0_0_6px_#ff3366]" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {SEASON_NAME} — Future Rewards Locked In
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-black leading-[1.05] tracking-tight mb-4">
              <span className="text-cyan-400 text-lg sm:text-xl font-extrabold tracking-[0.2em] uppercase block mb-2">
                What&apos;s your
              </span>
              <span className="text-white">Onchain </span>
              <span className="text-gradient-blue">Rank?</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base font-medium leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
              Free wallet scan on Base. Mint gasless badges, farm XP, and climb from Shrimp to God.
            </p>

            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto lg:mx-0 mb-8">
              {[
                { v: String(ACHIEVEMENTS.length), l: "Onchain Badges" },
                { v: String(WEEKLY_QUESTS.length), l: "XP Quests" },
                { v: String(getDaysLeft()), l: "Season Days" },
              ].map((s) => (
                <div key={s.l} className="glass-panel-accent rounded-2xl p-3 sm:p-4 text-center">
                  <p className="text-2xl sm:text-3xl font-black text-cyan-400">{s.v}</p>
                  <p className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-wide mt-1">{s.l}</p>
                </div>
              ))}
            </div>

            <button
              onClick={onOpenModal}
              disabled={loading}
              className="w-full max-w-md mx-auto lg:mx-0 py-4 rounded-2xl font-black text-base text-white flex flex-col items-center justify-center gap-1 disabled:opacity-60 btn-primary"
            >
              {loading ? (
                <>
                  <div className="flex items-center gap-2">
                    <RefreshCcw className="animate-spin" size={18} />
                    <span>Scanning wallet...</span>
                  </div>
                  {scanProgress && (
                    <span className="text-[10px] text-violet-200/50 font-normal">{scanProgress}</span>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Wallet size={20} />
                  <span>Get My Score — Free</span>
                </div>
              )}
            </button>
            <p className="text-center lg:text-left text-[10px] text-slate-500 flex items-center justify-center lg:justify-start gap-1.5 mt-3">
              <Droplets size={9} className="text-blue-400" />
              Gas sponsored via Coinbase Paymaster
            </p>
          </div>

          {/* RIGHT — Preview card */}
          <div className="hidden sm:block animate-float">
            <HeroTeaser />
            <div className="mt-4 glass-panel rounded-2xl p-4 max-w-[340px] mx-auto lg:mx-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Season Progress</span>
                <span className="text-[10px] font-black text-blue-400">{getDaysLeft()}d left</span>
              </div>
              <p className="text-4xl font-black text-white mb-2">
                {getSeasonPct()}<span className="text-xl text-slate-600">%</span>
              </p>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-rose-500 to-cyan-500 rounded-full transition-all duration-1000"
                  style={{ width: `${getSeasonPct()}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
          <div className="glass-panel rounded-3xl w-full max-w-sm p-6 relative shadow-2xl shadow-black/40">
            <button
              onClick={onCloseModal}
              className="absolute top-4 right-4 text-slate-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-linear-to-br from-rose-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/40">
                <Hexagon size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-black text-white text-base">Connect Wallet</h3>
                <p className="text-slate-500 text-xs mt-0.5">Gas-free via Paymaster</p>
              </div>
            </div>
            <div className="space-y-2">
              {(
                [
                  { type: "coinbase" as ConnectionType, label: "Coinbase Wallet", sub: "Best for gas sponsorship", emoji: "🔵", cls: "btn-primary hover:opacity-90 border-cyan-500/50" },
                  { type: "metamask" as ConnectionType, label: "MetaMask", sub: "EVM compatible wallet", emoji: "🦊", cls: "bg-white/5 hover:bg-white/10 border-white/10" },
                  { type: "farcaster" as ConnectionType, label: "Farcaster", sub: "Social + onchain wallet", emoji: "🟣", cls: "bg-white/5 hover:bg-white/10 border-white/10" },
                ] as const
              ).map((w) => (
                <button
                  key={w.type}
                  onClick={() => onConnect(w.type)}
                  className={`w-full flex items-center justify-between ${w.cls} border text-white p-4 rounded-2xl transition-all active:scale-[0.98] group`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-base">{w.emoji}</span>
                    <div className="text-left">
                      <p className="font-black text-sm">{w.label}</p>
                      <p className="text-[10px] text-slate-500">{w.sub}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-500 group-hover:text-white transition-all" />
                </button>
              ))}
            </div>
            {PAYMASTER_URL && (
              <div className="mt-4 flex items-center justify-center gap-1.5 bg-cyan-500/8 border border-cyan-500/20 rounded-xl p-2.5">
                <Droplets size={11} className="text-blue-400" />
                <p className="text-[10px] text-blue-400 font-bold">Paymaster active — gas sponsored</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
