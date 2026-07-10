import Link from "next/link";
import { Gift, HelpCircle, Shield, Zap } from "lucide-react";
import AppLogo from "@/components/ui/AppLogo";
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

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#03080f] text-white">
      <div className="absolute inset-0 bg-aurora pointer-events-none opacity-80" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <Link href={APP_URL_WEB} className="flex items-center gap-2 mb-10">
          <AppLogo size="md" />
          <span className="font-black tracking-widest uppercase text-sm">Base Analytics</span>
        </Link>

        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <HelpCircle className="text-violet-400" /> Help & FAQ
        </h1>
        <p className="text-slate-400 mt-2 text-sm leading-relaxed">
          Everything you need to send vouchers, redeem gifts, and use onchain analytics on Base.
        </p>

        <div className="mt-8 space-y-4">
          {FAQ.map((item) => (
            <div key={item.q} className="elegant-panel rounded-2xl p-5 border border-white/10">
              <p className="font-black text-white text-sm">{item.q}</p>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>

        <div id="api" className="mt-12 elegant-panel rounded-3xl p-6 border border-violet-500/20">
          <p className="section-eyebrow text-violet-300">API & integrations</p>
          <h2 className="text-xl font-black text-white mt-2">Public endpoints</h2>
          <ul className="mt-4 space-y-3 text-sm font-mono text-slate-300">
            <li className="rounded-xl bg-black/30 px-3 py-2 border border-white/8">GET /api/launchpad/market — live volume & mcap</li>
            <li className="rounded-xl bg-black/30 px-3 py-2 border border-white/8">GET /api/launchpad/activity — global feed</li>
            <li className="rounded-xl bg-black/30 px-3 py-2 border border-white/8">GET /api/analyze-wallet?address=0x…</li>
            <li className="rounded-xl bg-black/30 px-3 py-2 border border-white/8">GET /api/voucher/card-preview?card=12-3</li>
            <li className="rounded-xl bg-black/30 px-3 py-2 border border-white/8">POST /api/premium-scan (x402)</li>
            <li className="rounded-xl bg-black/30 px-3 py-2 border border-white/8">POST /api/mcp — voucher tools for agents</li>
          </ul>
          <p className="text-xs text-slate-500 mt-4 flex items-center gap-2">
            <Shield size={12} /> MCP plugin: <code className="text-violet-300">skills/base-mcp/plugins/base-voucher.md</code>
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/explore" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl btn-primary font-black text-sm">
            Explore tokens
          </Link>
          <Link href={`${APP_URL_WEB}/?tab=voucher`} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 border border-white/15 font-black text-sm">
            <Gift size={16} /> Create voucher
          </Link>
          <Link href="/redeem" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 border border-white/15 font-black text-sm">
            <Zap size={16} /> Redeem card
          </Link>
        </div>
      </div>
    </div>
  );
}
