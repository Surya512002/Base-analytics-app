"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, RefreshCcw, Wallet } from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import { getDaysLeft, getSeasonPct } from "@/lib/utils/season";
import { fetchLaunchpadTokens } from "@/lib/api/launchpad-client";
import { createdAgo } from "@/lib/launchpad/format";
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import type { ConnectionType } from "@/lib/types/wallet";

interface ConnectScreenProps {
  loading: boolean;
  scanProgress: string;
  showModal: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
  onConnect: (type: ConnectionType) => void;
}

function LaunchpadTeaser() {
  const [tokens, setTokens] = useState<
    { name: string; symbol: string; createdAt: number }[]
  >([]);

  useEffect(() => {
    void fetchLaunchpadTokens().then((d) => {
      setTokens(
        [...d.tokens]
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 4)
          .map((t) => ({ name: t.name, symbol: t.symbol, createdAt: t.createdAt }))
      );
    });
  }, []);

  const display =
    tokens.length > 0
      ? tokens
      : [
          { name: "Your token", symbol: "YOU", createdAt: 0 },
          { name: "Base launch", symbol: "BASE", createdAt: 0 },
        ];

  return (
    <div className="w-full max-w-[360px] mx-auto lg:mx-0">
      <div className="rounded-xl border border-white/[0.08] bg-[var(--bg-raised)] p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="section-eyebrow">Just launched</p>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            <span className="live-dot" />
            Live
          </span>
        </div>
        <div className="space-y-2">
          {display.map((t) => (
            <div
              key={t.symbol + t.name}
              className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2.5 flex items-center justify-between"
            >
              <div>
                <p className="text-[13px] font-semibold text-[var(--ink)]">{t.name}</p>
                <p className="text-[11px] text-[var(--ink-muted)] font-mono mt-0.5">${t.symbol}</p>
              </div>
              <p className="text-[11px] text-[var(--ink-dim)]">{createdAgo(t.createdAt)}</p>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-[var(--ink-dim)] mt-4 leading-relaxed">
          Launch native B20 tokens and trade Uniswap + Aerodrome from one terminal.
        </p>
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
    <div className="min-h-screen bg-[var(--bg-deep)] flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-noise pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 55%)",
        }}
      />

      <div className="relative z-10 w-full max-w-5xl">
        <div className="flex items-center gap-3 mb-10 lg:mb-14">
          <AppLogo size="lg" />
          <span className="font-display font-bold text-xl sm:text-2xl text-[var(--ink)] tracking-tight">
            BASE ANALYTICS
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <p className="section-eyebrow mb-4 inline-flex items-center gap-2">
              <span className="live-dot" />
              B20 on Base mainnet
            </p>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[0.98] tracking-tight mb-4 text-[var(--ink)]">
              Launch tokens.
              <br />
              Trade on Base.
            </h1>
            <p className="text-[15px] sm:text-base text-[var(--ink-muted)] leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
              Create B20 tokens, swap when liquidity exists, and track your onchain score —
              all in one Base mini-app.
            </p>

            <button
              onClick={onOpenModal}
              disabled={loading}
              className="w-full max-w-md mx-auto lg:mx-0 py-3.5 rounded-lg text-[14px] font-semibold text-[#080808] bg-[var(--ink)] hover:bg-white flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
            >
              {loading ? (
                <>
                  <RefreshCcw className="animate-spin" size={16} />
                  <span>{scanProgress || "Connecting…"}</span>
                </>
              ) : (
                <>
                  <Wallet size={18} />
                  <span>Connect wallet</span>
                  <ArrowUpRight size={16} />
                </>
              )}
            </button>
            <p className="text-[11px] text-[var(--ink-dim)] mt-3">
              Base network · browse Explore without connecting
            </p>
          </div>

          <div className="hidden sm:block">
            <LaunchpadTeaser />
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-[var(--bg-raised)] p-4 max-w-[360px] mx-auto lg:mx-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
                  Season progress
                </span>
                <span className="text-[11px] font-mono text-[var(--ink-muted)]">
                  {getDaysLeft()}d left
                </span>
              </div>
              <p className="font-display text-3xl font-bold text-[var(--ink)] mb-2 tracking-tight">
                {getSeasonPct()}
                <span className="text-lg text-[var(--ink-dim)]">%</span>
              </p>
              <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--ink)] rounded-full transition-all duration-700"
                  style={{ width: `${getSeasonPct()}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConnectWalletModal
        open={showModal}
        loading={loading}
        onClose={onCloseModal}
        onConnect={onConnect}
      />
    </div>
  );
}
