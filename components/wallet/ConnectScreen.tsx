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
import { SEASON_NAME, WEEKLY_QUESTS } from "@/lib/constants/season";
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

export default function ConnectScreen({
  loading,
  scanProgress,
  showModal,
  onOpenModal,
  onCloseModal,
  onConnect,
}: ConnectScreenProps) {
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-75 bg-blue-600/12 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-100 h-75 bg-blue-500/8 rounded-full blur-3xl pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(59,130,246,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.05) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="w-20 h-20 bg-linear-to-br from-blue-500 to-blue-700 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-600/50">
              <Hexagon size={36} className="text-white" />
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-blue-400 rounded-full border-2 border-[#0a0f1e] flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">
            BASE<span className="text-blue-400">.</span>ANALYTICS
          </h1>
          <p className="text-blue-300/60 text-sm">
            Your onchain identity on Base · Farm XP · Climb the leaderboard
          </p>
        </div>
        <div className="bg-[#0d1628] border border-blue-500/25 rounded-3xl p-5 mb-4 shadow-xl shadow-blue-900/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Star size={13} className="text-blue-400" />
              </div>
              <span className="text-[10px] font-black text-blue-400/70 uppercase tracking-widest">
                {SEASON_NAME}
              </span>
            </div>
            <span className="text-[10px] font-black text-blue-300 bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 rounded-lg">
              {getDaysLeft()}d left
            </span>
          </div>
          <div className="mb-4">
            <p className="text-[10px] font-black text-blue-400/50 uppercase tracking-widest mb-1">
              SEASON PROGRESS
            </p>
            <p className="text-5xl font-black text-white">
              {getSeasonPct()}
              <span className="text-2xl text-blue-400/40">%</span>
            </p>
          </div>
          <div className="w-full bg-blue-950/60 rounded-full h-1.5 overflow-hidden border border-blue-800/40">
            <div
              className="h-full bg-linear-to-r from-blue-500 to-blue-400 rounded-full"
              style={{
                width: `${getSeasonPct()}%`,
                transition: "width 2s ease-out",
              }}
            />
          </div>
          <div className="mt-4 space-y-2">
            {[
              {
                icon: <Trophy size={14} className="text-blue-400" />,
                label: "Achievement Badges",
                value: "11 Categories",
              },
              {
                icon: <Target size={14} className="text-blue-300" />,
                label: "Weekly Quests",
                value: `${WEEKLY_QUESTS.length} Available`,
              },
              {
                icon: <Zap size={14} className="text-blue-400" />,
                label: "XP Farming",
                value: "Carry-over weekly",
              },
            ].map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-blue-950/40 rounded-xl px-3 py-2.5 border border-blue-800/30"
              >
                <div className="flex items-center gap-2.5">
                  {r.icon}
                  <span className="text-xs text-blue-100/80 font-bold">
                    {r.label}
                  </span>
                </div>
                <span className="text-xs font-black text-blue-400">
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={onOpenModal}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white py-4 rounded-2xl font-black text-base flex flex-col items-center justify-center gap-1 transition-all shadow-2xl shadow-blue-600/40 mb-3 disabled:opacity-60"
        >
          {loading ? (
            <>
              <div className="flex items-center gap-2">
                <RefreshCcw className="animate-spin" size={18} />
                <span>Scanning wallet...</span>
              </div>
              {scanProgress && (
                <span className="text-[10px] text-blue-200/60 font-normal">
                  {scanProgress}
                </span>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Wallet size={20} />
              <span>Connect & Check Score</span>
            </div>
          )}
        </button>
        <p className="text-center text-[10px] text-blue-400/40 flex items-center justify-center gap-1.5">
          <Droplets size={9} />
          Gas fees sponsored by Coinbase Paymaster
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0d1628] border border-blue-500/25 rounded-3xl w-full max-w-sm p-6 relative shadow-2xl shadow-blue-900/40">
            <button
              onClick={onCloseModal}
              className="absolute top-4 right-4 text-blue-400/50 hover:text-white w-8 h-8 flex items-center justify-center rounded-xl bg-blue-950/60 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/40">
                <Hexagon size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-black text-white text-base">
                  Connect Wallet
                </h3>
                <p className="text-blue-300/50 text-xs mt-0.5">
                  All transactions gas-free via Paymaster
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {(
                [
                  {
                    type: "coinbase" as ConnectionType,
                    label: "Coinbase Wallet",
                    sub: "Best for gas sponsorship",
                    emoji: "🔵",
                    cls: "bg-blue-600 hover:bg-blue-500 border-blue-500/50",
                  },
                  {
                    type: "metamask" as ConnectionType,
                    label: "MetaMask",
                    sub: "EVM compatible wallet",
                    emoji: "🦊",
                    cls: "bg-[#0d1628] hover:bg-blue-950/60 border-blue-700/30",
                  },
                  {
                    type: "farcaster" as ConnectionType,
                    label: "Farcaster",
                    sub: "Social + onchain wallet",
                    emoji: "🟣",
                    cls: "bg-[#0d1628] hover:bg-blue-950/60 border-blue-700/30",
                  },
                ] as const
              ).map((w) => (
                <button
                  key={w.type}
                  onClick={() => onConnect(w.type)}
                  className={`w-full flex items-center justify-between ${w.cls} border text-white p-4 rounded-2xl transition-all active:scale-[0.98] group`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-base">
                      {w.emoji}
                    </span>
                    <div className="text-left">
                      <p className="font-black text-sm">{w.label}</p>
                      <p className="text-[10px] text-blue-300/50">{w.sub}</p>
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-blue-400/50 group-hover:text-white transition-all"
                  />
                </button>
              ))}
            </div>
            {PAYMASTER_URL && (
              <div className="mt-4 flex items-center justify-center gap-1.5 bg-blue-500/8 border border-blue-500/20 rounded-xl p-2.5">
                <Droplets size={11} className="text-blue-400" />
                <p className="text-[10px] text-blue-400 font-bold">
                  Coinbase Paymaster active — gas fees sponsored
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
