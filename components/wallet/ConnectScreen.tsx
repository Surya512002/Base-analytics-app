"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCcw, Wallet } from "lucide-react";
import AppModeCards from "@/components/ui/AppModeCards";
import { getDaysLeft, getSeasonPct } from "@/lib/utils/season";
import { fetchLaunchpadTokens } from "@/lib/api/launchpad-client";
import { createdAgo } from "@/lib/launchpad/format";
import ConnectWalletModal from "@/components/wallet/ConnectWalletModal";
import AppFooterNav from "@/components/wallet/AppFooterNav";
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
    <div className="card-quiet p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
          Just launched
        </p>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          <span className="live-dot" />
          Live
        </span>
      </div>
      <div className="space-y-2">
        {display.map((t) => (
          <div
            key={t.symbol + t.name}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2.5 flex items-center justify-between"
          >
            <div>
              <p className="text-[13px] font-semibold text-[var(--ink)]">{t.name}</p>
              <p className="text-[11px] text-[var(--ink-muted)] font-mono mt-0.5">${t.symbol}</p>
            </div>
            <p className="text-[11px] text-[var(--ink-dim)]">{createdAgo(t.createdAt)}</p>
          </div>
        ))}
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
    <div className="flex min-h-screen min-h-[100dvh] w-full min-w-0 flex-col">
      {/* Full-bleed hero */}
      <div className="relative w-full overflow-hidden">
        <section className="relative min-h-[70vh] min-h-[70dvh] overflow-hidden sm:min-h-[78vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/base-analytics-hero-lanes.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#eef3fb]/95 via-[#eef3fb]/85 to-[#eef3fb]/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent" />
          <div className="lane-rail lane-animated absolute bottom-0 left-0 right-0 h-1.5" />

          <div className="app-container relative flex min-h-[70vh] min-h-[70dvh] flex-col justify-center py-12 pb-20 sm:min-h-[78vh] sm:py-16 sm:pb-24 md:pb-28">
            <p className="animate-rise font-display text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl md:text-6xl">
              Base Analytics
            </p>
            <h1 className="animate-rise-delay mt-5 max-w-2xl font-display text-2xl font-semibold leading-snug text-[var(--ink-soft)] md:text-3xl">
              Launch B20 tokens. Trade any asset on Base.
            </h1>
            <p className="animate-rise-delay-2 mt-4 max-w-xl text-base text-[var(--ink-muted)] md:text-lg">
              Discover top movers, swap via Uniswap + Aerodrome, track your onchain score, and grow
              with quests — all in one Base mini-app.
            </p>
            <div className="animate-rise-delay-2 mt-9 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onOpenModal}
                disabled={loading}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <RefreshCcw className="animate-spin" size={16} />
                    {scanProgress || "Connecting…"}
                  </>
                ) : (
                  <>
                    <Wallet size={18} />
                    Connect wallet
                    <ArrowUpRight size={16} />
                  </>
                )}
              </button>
              <Link href="/explore" className="btn-secondary">
                Browse Explore
              </Link>
              <Link href="/docs" className="btn-ghost">
                Documents →
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="app-container w-full min-w-0 flex-1 space-y-10 py-8 sm:py-10 md:py-12">
        <AppModeCards />

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <LaunchpadTeaser />
          <div className="card-quiet p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
                Season progress
              </span>
              <span className="text-[11px] font-mono text-[var(--ink-muted)]">{getDaysLeft()}d left</span>
            </div>
            <p className="font-display text-3xl font-bold text-[var(--ink)] mb-2 tracking-tight">
              {getSeasonPct()}
              <span className="text-lg text-[var(--ink-dim)]">%</span>
            </p>
            <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
              <div
                className="h-full lane-rail rounded-full transition-all duration-700"
                style={{ width: `${getSeasonPct()}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <AppFooterNav />

      <ConnectWalletModal
        open={showModal}
        loading={loading}
        onClose={onCloseModal}
        onConnect={onConnect}
      />
    </div>
  );
}
