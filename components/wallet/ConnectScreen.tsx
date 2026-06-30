import {
  BarChart3,
  ChevronRight,
  Droplets,
  Gift,
  RefreshCcw,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import { PAYMASTER_URL } from "@/lib/constants/env";
import { SEASON_NAME } from "@/lib/constants/season";
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

const LANDING_FEATURES = [
  {
    n: "01",
    icon: <Zap size={16} className="text-amber-400" />,
    title: "x402 Payments",
    desc: "Decentralized pay-per-use on Base — no accounts, no middlemen.",
  },
  {
    n: "02",
    icon: <Gift size={16} className="text-cyan-400" />,
    title: "Crypto Gift Cards",
    desc: "Create & redeem ETH or USDC vouchers. Split into up to 50 cards.",
  },
  {
    n: "03",
    icon: <BarChart3 size={16} className="text-rose-400" />,
    title: "Onchain Analysis",
    desc: "Free wallet scan, badges, XP quests, and your rank from Shrimp to God.",
  },
] as const;

function GiftCardTeaser() {
  return (
    <div className="relative w-full max-w-[360px] mx-auto lg:mx-0">
      <div className="absolute -inset-1 bg-linear-to-r from-cyan-500/20 via-violet-500/15 to-rose-500/20 rounded-3xl blur-xl" />
      <div className="relative glass-panel rounded-3xl p-6 border border-cyan-500/20 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl" />
        <div className="flex items-center gap-2 mb-4">
          <Gift size={14} className="text-cyan-400" />
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.35em]">
            Base Voucher
          </p>
        </div>
        <div className="rounded-2xl bg-linear-to-br from-blue-600/40 via-cyan-500/20 to-violet-600/30 border border-white/10 p-5 mb-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Card ID · 12-3
          </p>
          <p className="font-mono text-sm text-white/90 tracking-wider mb-4">
            K7M2P-9XQ4R-8N3WT-5J6YH
          </p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Balance</p>
              <p className="text-3xl font-black text-white">25.00</p>
              <p className="text-xs font-bold text-cyan-400">USDC</p>
            </div>
            <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2.5 py-1 uppercase">
              Redeemable
            </span>
          </div>
        </div>
        <p className="text-slate-300 text-sm font-medium leading-relaxed">
          Send crypto to anyone with a shareable card code — fully onchain on Base.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["ETH", "USDC", "Onchain", "Decentralized"].map((tag) => (
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
    <div className="min-h-screen bg-[#040a14] flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
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
          <AppLogo size="lg" />
          <span className="font-black text-lg sm:text-xl text-white tracking-[0.2em] uppercase">
            Base Analytics
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* LEFT — Hero */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 badge-live rounded-full px-4 py-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-glow shadow-[0_0_6px_#10b981]" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                x402 Live · Decentralized on Base
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-black leading-[1.05] tracking-tight mb-3">
              <span className="text-white">Crypto </span>
              <span className="text-gradient-blue">Gift Cards</span>
            </h1>
            <p className="text-cyan-400 text-lg sm:text-xl font-extrabold tracking-wide mb-4">
              For anyone, anywhere!
            </p>
            <p className="text-slate-400 text-sm sm:text-base font-medium leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
              The world&apos;s first decentralized tangible crypto gift card protocol.
              Create and redeem crypto gift cards on Base — then unlock your full onchain profile.
            </p>

            <div className="space-y-3 max-w-md mx-auto lg:mx-0 mb-8">
              {LANDING_FEATURES.map((f) => (
                <div
                  key={f.n}
                  className="glass-panel-accent rounded-2xl p-4 flex items-start gap-3 text-left"
                >
                  <div className="shrink-0 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    {f.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                      {f.n}
                    </p>
                    <p className="text-sm font-black text-white">{f.title}</p>
                    <p className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">
                      {f.desc}
                    </p>
                  </div>
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
                  <span>Connect Wallet — Free</span>
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
            <GiftCardTeaser />
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
              <AppLogo size="md" />
              <div>
                <h3 className="font-black text-white text-base">Connect Wallet</h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Gift cards, x402 & onchain analysis
                </p>
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
                  disabled={loading}
                  className={`w-full flex items-center justify-between ${w.cls} border text-white p-4 rounded-2xl transition-all active:scale-[0.98] group disabled:opacity-50 disabled:pointer-events-none`}
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
