"use client";

import Link from "next/link";

const LAUNCH_IMG = "/brand/base-analytics-mode-launch.png";
const TRADE_IMG = "/brand/base-analytics-mode-trade.png";

/** Dual feature cards — Paylane layout, Base Analytics artwork & copy. */
export default function AppModeCards({
  onExplore,
  onSwap,
}: {
  onExplore?: () => void;
  onSwap?: () => void;
}) {
  return (
    <section className="w-full min-w-0 pb-8 pt-2">
      <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">
        How Base Analytics works
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--ink-muted)]">
        Two lanes — launch tokens and trade the ecosystem — in one app on Base.
      </p>
      <div className="mt-8 grid w-full min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
        <article className="card overflow-hidden p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LAUNCH_IMG} alt="" className="h-48 w-full object-cover" />
          <div className="p-5">
            <span className="badge badge-brand">Mode A · Launch</span>
            <h3 className="font-display mt-3 text-xl font-semibold text-[var(--ink)]">
              Explore &amp; B20 launch
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
              Discover top movers, launch vanity B20 tokens, seed Aerodrome liquidity, and share
              token pages — without leaving the app.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-[var(--ink-soft)]">
              <li>· $0 B20 launch on Base</li>
              <li>· In-app Uniswap + Aerodrome routing</li>
              <li>· Creator announcements &amp; referrals</li>
            </ul>
            {onExplore ? (
              <button
                type="button"
                onClick={onExplore}
                className="mt-4 inline-block text-sm font-semibold text-[var(--brand-dark)]"
              >
                Open Explore →
              </button>
            ) : (
              <Link
                href="/explore"
                className="mt-4 inline-block text-sm font-semibold text-[var(--brand-dark)]"
              >
                Open Explore →
              </Link>
            )}
          </div>
        </article>
        <article className="card overflow-hidden p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TRADE_IMG} alt="" className="h-48 w-full object-cover" />
          <div className="p-5">
            <span className="badge badge-ok">Mode B · Trade</span>
            <h3 className="font-display mt-3 text-xl font-semibold text-[var(--ink)]">
              Swap &amp; analytics
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
              Swap any Base ERC-20, track onchain score, unlock x402 insights, earn quest XP, and
              mint badges — all from your wallet.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-[var(--ink-soft)]">
              <li>· Multi-DEX + 0x aggregator quotes</li>
              <li>· Onchain score &amp; heatmap</li>
              <li>· Quests, vouchers &amp; gasless badges</li>
            </ul>
            {onSwap ? (
              <button
                type="button"
                onClick={onSwap}
                className="mt-4 inline-block text-sm font-semibold text-[var(--success)]"
              >
                Open Swap →
              </button>
            ) : (
              <Link
                href="/swap"
                className="mt-4 inline-block text-sm font-semibold text-[var(--success)]"
              >
                Open Swap →
              </Link>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
