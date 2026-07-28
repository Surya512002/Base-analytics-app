import Link from "next/link";
import { BookOpen, Gift, Shield, Zap } from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
import AppModeCards from "@/components/ui/AppModeCards";
import { APP_URL_WEB } from "@/lib/constants/env";

const FAQ = [
  {
    q: "How do I explore tokens without connecting?",
    a: "Open /explore to browse the B20 launchpad marketplace — live prices, volume, and token pages work without a wallet. Connect only to swap or launch.",
  },
  {
    q: "What is the B20 Launchpad?",
    a: "Create native B20 tokens on Base with $0 launch fee, vanity 0xB200… addresses, dual-DEX swaps (Uniswap + Aerodrome), creator announcements, referral fee splits, and optional anti-snipe windows.",
  },
  {
    q: "What is Base Voucher?",
    a: "Base Voucher lets you create onchain crypto gift cards on Base. Fund a batch in ETH or USDC, split into up to 50 cards, and share Card ID + secret with recipients.",
  },
  {
    q: "How do I redeem a gift card?",
    a: "Go to /redeem or open the Vouchers tab → Redeem. Enter Card ID and secret, connect your wallet on Base, and confirm the claim transaction.",
  },
  {
    q: "What is x402?",
    a: "HTTP 402 micropayments on Base. Pay USDC to unlock premium wallet insights — Deep Scan from $0.01, Export $0.05, Compare Pro $0.10. No subscription required.",
  },
  {
    q: "How do referrals work?",
    a: "Share your referral link from the dashboard. Friends get +50 XP when they connect; you earn +25 XP per invite.",
  },
  {
    q: "How do I launch a token with liquidity?",
    a: "Open Explore → Launch. Enable “Auto-seed Aerodrome pool” — default is 0.001 ETH (~$2–3). Presets show USD value. Tokens become swappable in-app right after launch.",
  },
  {
    q: "What keyboard shortcuts exist?",
    a: "Press ⌘K (Mac) or Ctrl+K to open the command palette — jump to Explore, Analytics, Vouchers, quests, or search tokens.",
  },
  {
    q: "Are badge mints gasless?",
    a: "When Coinbase Paymaster is configured, badge mints and many app transactions can be gas-sponsored on Base.",
  },
];

export default function DocumentsPage() {
  return (
    <div className="min-h-screen min-h-[100dvh] w-full min-w-0 text-[var(--ink)]">
      <div className="app-container relative z-10 py-8 sm:py-10 md:py-12">
        <Link href={APP_URL_WEB} className="group mb-8 inline-flex items-center gap-2.5">
          <AppLogo size="sm" />
          <span className="font-display text-xl font-bold tracking-tight text-[var(--ink)]">
            Base Analytics
          </span>
        </Link>

        <div className="brand-hero-wrap mb-10 min-h-[200px] sm:min-h-[240px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/base-analytics-hero-lanes.png"
            alt=""
            className="brand-hero-img"
          />
          <div className="brand-hero-overlay" aria-hidden />
          <div className="lane-rail absolute bottom-0 left-0 right-0 h-1 z-[2]" aria-hidden />
          <div className="brand-hero-body flex h-full flex-col justify-end">
            <span className="badge badge-brand mb-3 inline-flex w-fit px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
              Documents
            </span>
            <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-4xl">
              Guides, FAQ &amp; API
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--ink-muted)]">
              Everything you need to launch on Base, swap tokens, use vouchers, and integrate with
              our API.
            </p>
          </div>
        </div>

        <AppModeCards />

        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold text-[var(--ink)] flex items-center gap-2">
            <BookOpen size={22} className="text-[var(--brand)]" />
            FAQ
          </h2>
          <div className="mt-6 space-y-4">
            {FAQ.map((item) => (
              <div key={item.q} className="card p-5">
                <p className="text-sm font-semibold text-[var(--ink)]">{item.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="api" className="card mt-12 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-dim)]">
            API &amp; integrations
          </p>
          <h2 className="font-display mt-2 text-xl font-semibold text-[var(--ink)]">
            Public endpoints
          </h2>
          <ul className="mt-4 space-y-3 font-mono text-sm text-[var(--ink-muted)]">
            <li className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2">
              GET /api/launchpad/market — live volume &amp; mcap
            </li>
            <li className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2">
              GET /api/launchpad/activity — global feed
            </li>
            <li className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2">
              GET /api/analyze-wallet?address=0x…
            </li>
            <li className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2">
              GET /api/voucher/card-preview?card=12-3
            </li>
            <li className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2">
              POST /api/premium-scan (x402)
            </li>
            <li className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2">
              POST /api/mcp — voucher tools for agents
            </li>
          </ul>
          <p className="mt-4 flex items-center gap-2 text-xs text-[var(--ink-dim)]">
            <Shield size={12} /> MCP plugin:{" "}
            <code className="text-[var(--ink)]">skills/base-mcp/plugins/base-voucher.md</code>
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/explore" className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold">
            Explore tokens
          </Link>
          <Link
            href={`${APP_URL_WEB}/?tab=voucher`}
            className="btn-secondary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold"
          >
            <Gift size={16} /> Create voucher
          </Link>
          <Link
            href="/redeem"
            className="btn-secondary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold"
          >
            <Zap size={16} /> Redeem card
          </Link>
        </div>
      </div>
    </div>
  );
}
