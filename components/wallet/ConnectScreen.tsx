"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  ChevronRight,
  Droplets,
  Gift,
  Globe,
  RefreshCcw,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import {
  BaseAppWalletIcon,
  FarcasterWalletIcon,
  MetaMaskWalletIcon,
} from "@/components/wallet/WalletBrandIcon";
import { PAYMASTER_URL } from "@/lib/constants/env";
import { SEASON_NAME } from "@/lib/constants/season";
import { getDaysLeft, getSeasonPct } from "@/lib/utils/season";
import { isInsideBaseMiniApp, detectMiniAppHost, type MiniAppHost } from "@/lib/utils/mini-app-connect";
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
    icon: <TrendingUp size={16} className="text-emerald-400" />,
    title: "Crypto Prediction Market",
    desc: "BTC · ETH · SOL — 15m, hourly, 4h & daily rounds with live YES/NO odds on Base.",
  },
  {
    n: "02",
    icon: <Zap size={16} className="text-amber-400" />,
    title: "Trade & earn XP",
    desc: "Every prediction trade counts toward daily points and weekly quests — climb the leaderboard.",
  },
  {
    n: "03",
    icon: <Gift size={16} className="text-cyan-400" />,
    title: "Vouchers & analytics",
    desc: "Gift cards, wallet scan, badges, and check-in rewards — all in one Base mini-app.",
  },
] as const;

type WalletOption = {
  type: ConnectionType;
  label: string;
  sub: string;
  icon: ReactNode;
  accent: string;
};

const WALLET_OPTIONS: WalletOption[] = [
  {
    type: "baseAccount",
    label: "Coinbase Base Wallet",
    sub: "Email or passkey — smart wallet in your browser on Base",
    icon: <BaseAppWalletIcon size={30} />,
    accent: "bg-[#0052FF] border-[#0052FF]/60 shadow-[0_0_20px_rgba(0,82,255,0.25)]",
  },
  {
    type: "coinbase",
    label: "Base App / Extension",
    sub: "Coinbase Wallet extension or mobile deep link",
    icon: <BaseAppWalletIcon size={30} />,
    accent: "bg-[#0052FF] border-[#0052FF]/60 shadow-[0_0_20px_rgba(0,82,255,0.25)]",
  },
  {
    type: "metamask",
    label: "MetaMask",
    sub: "Popular browser extension",
    icon: <MetaMaskWalletIcon size={30} />,
    accent: "bg-[#F6851B]/15 border-[#F6851B]/45",
  },
  {
    type: "injected",
    label: "Browser Wallet",
    sub: "Rabby, Rainbow, OKX & other injected wallets",
    icon: <Globe size={22} className="text-cyan-600" />,
    accent: "bg-cyan-500/12 border-cyan-400/35",
  },
  {
    type: "farcaster",
    label: "Farcaster Wallet",
    sub: "Warpcast & Farcaster mini-app wallet",
    icon: <FarcasterWalletIcon size={30} />,
    accent: "bg-[#855DCD]/20 border-[#855DCD]/50",
  },
];

function PredictionMarketTeaser() {
  const markets = [
    { asset: "BTC", prob: 58, price: "$97,240", dur: "15M" },
    { asset: "ETH", prob: 44, price: "$3,612", dur: "1H" },
    { asset: "SOL", prob: 62, price: "$148", dur: "Daily" },
  ];

  return (
    <div className="relative w-full max-w-[360px] mx-auto lg:mx-0">
      <div className="absolute -inset-1 bg-linear-to-r from-emerald-500/20 via-cyan-500/15 to-violet-500/20 rounded-3xl blur-xl" />
      <div className="relative glass-panel rounded-3xl p-6 border border-emerald-500/20 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-emerald-400" />
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.35em]">
            Live on Base
          </p>
        </div>
        <div className="space-y-2 mb-4">
          {markets.map((m) => (
            <div
              key={m.asset}
              className="rounded-xl bg-white/[0.04] border border-white/10 p-3 flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-black text-white">{m.asset} · {m.dur}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{m.price}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-emerald-400 tabular-nums">{m.prob}%</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase">YES</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-slate-300 text-sm font-medium leading-relaxed">
          Polymarket-style crypto markets with CPMM pricing — trade YES or NO, win $1 USDC per share on resolve.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["BTC", "ETH", "SOL", "CPMM", "Chainlink"].map((tag) => (
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
  const [inMiniApp, setInMiniApp] = useState(false);
  const [miniAppHost, setMiniAppHost] = useState<MiniAppHost | null>(null);

  useEffect(() => {
    void (async () => {
      const inside = await isInsideBaseMiniApp();
      setInMiniApp(inside);
      if (inside) {
        setMiniAppHost(await detectMiniAppHost());
        try {
          const { sdk } = await import("@farcaster/miniapp-sdk");
          await sdk.actions.ready?.();
        } catch {
          /* optional */
        }
      } else {
        setMiniAppHost(null);
      }
    })();
  }, []);

  const walletOptions = useMemo(() => {
    if (!inMiniApp) return WALLET_OPTIONS;

    const embedded: WalletOption =
      miniAppHost === "warpcast"
        ? {
            type: "farcaster",
            label: "Farcaster Wallet",
            sub: "Your Warpcast smart wallet on Base",
            icon: <FarcasterWalletIcon size={30} />,
            accent: "bg-[#855DCD]/20 border-[#855DCD]/50",
          }
        : {
            type: "farcaster",
            label: "Base App Smart Wallet",
            sub: "Passkey smart wallet inside Base App",
            icon: <BaseAppWalletIcon size={30} />,
            accent:
              "bg-[#0052FF] border-[#0052FF]/60 shadow-[0_0_20px_rgba(0,82,255,0.25)]",
          };

    // In mini-app iframes only the embedded SDK wallet works — hide extension wallets.
    return [embedded];
  }, [inMiniApp, miniAppHost]);

  return (
    <div className="min-h-screen bg-[#020508] flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
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
                12 markets live · BTC ETH SOL on Base
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-black leading-[1.05] tracking-tight mb-3">
              <span className="text-white">Crypto </span>
              <span className="text-gradient-blue">Predictions</span>
            </h1>
            <p className="text-emerald-400 text-lg sm:text-xl font-extrabold tracking-wide mb-4">
              Trade the market. Earn XP. Win USDC.
            </p>
            <p className="text-slate-400 text-sm sm:text-base font-medium leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
              Hourly, 4-hour & daily BTC/ETH/SOL rounds with live YES/NO odds.
              Connect your wallet to trade, complete quests, and climb the leaderboard.
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
                    <span>{scanProgress || "Calculating score…"}</span>
                  </div>
                  {scanProgress && (
                    <span className="text-[10px] text-violet-200/50 font-normal">{scanProgress}</span>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Wallet size={20} />
                  <span>Connect Wallet — Start trading</span>
                </div>
              )}
            </button>
            <p className="text-center lg:text-left text-[10px] text-slate-500 flex items-center justify-center lg:justify-start gap-1.5 mt-3">
              <Droplets size={9} className="text-blue-400" />
              Base network only · gas sponsored via Coinbase Paymaster
            </p>
          </div>

          {/* RIGHT — Preview card */}
          <div className="hidden sm:block animate-float">
            <PredictionMarketTeaser />
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel rounded-3xl w-full max-w-md p-5 sm:p-6 relative shadow-2xl shadow-black/50 border border-white/12">
            <button
              onClick={onCloseModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-xl bg-white/8 border border-white/10 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-4 pr-8">
              <AppLogo size="md" />
              <div>
                <h3 className="font-black text-white text-lg">Connect Wallet</h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Base network only — switch if prompted
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-xl bg-blue-500/10 border border-blue-400/25 px-3.5 py-2.5">
              <p className="text-[11px] font-bold text-blue-200 leading-relaxed">
                {inMiniApp ? (
                  miniAppHost === "warpcast" ? (
                    <>
                      You&apos;re in <span className="text-white font-black">Warpcast</span> — connect
                      with your <span className="text-white font-black">Farcaster Wallet</span>.
                      Score loads in ~20s; heatmap refines in the background.
                    </>
                  ) : (
                    <>
                      You&apos;re in <span className="text-white font-black">Base App</span> — connect
                      with <span className="text-white font-black">Base App Smart Wallet</span>. Score
                      and stats load in ~20s; heatmap refines quietly after.
                    </>
                  )
                ) : (
                  <>
                    This app runs on <span className="text-white font-black">Base mainnet</span> only.
                    Your wallet must be connected to Base — we&apos;ll prompt you to switch networks if needed.
                  </>
                )}
              </p>
            </div>

            <div className="space-y-2.5">
              {walletOptions.map((w) => (
                <button
                  key={w.type}
                  onClick={() => onConnect(w.type)}
                  disabled={loading}
                  className={`w-full flex items-center justify-between border ${w.accent} text-white p-3.5 rounded-2xl transition-all active:scale-[0.98] group disabled:opacity-50 disabled:pointer-events-none hover:brightness-110`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-11 h-11 shrink-0 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-sm">
                      {w.icon}
                    </span>
                    <div className="text-left min-w-0">
                      <p className="font-black text-sm text-white">{w.label}</p>
                      <p className="text-[11px] text-slate-300/90 leading-snug mt-0.5">{w.sub}</p>
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    className="text-white/50 group-hover:text-white shrink-0 transition-colors"
                  />
                </button>
              ))}
            </div>

            {PAYMASTER_URL && (
              <div className="mt-4 flex items-center justify-center gap-1.5 bg-cyan-500/10 border border-cyan-500/25 rounded-xl p-2.5">
                <Droplets size={11} className="text-cyan-300" />
                <p className="text-[10px] text-cyan-200 font-bold">
                  Paymaster active — gas sponsored on Base App Wallet
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
