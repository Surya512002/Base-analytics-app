import { Gift, Globe, Lock, Sparkles, Zap } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";

const POINTS = [
  {
    icon: <Globe size={16} className="text-[var(--ink-muted)]" />,
    title: "Anyone, anywhere",
    desc: "Send crypto & stock gifts across borders instantly — no bank, no app store, no geographic limits.",
  },
  {
    icon: <Lock size={16} className="text-emerald-400" />,
    title: "Fully onchain & secure",
    desc: "Funds live in a verified smart contract on Base. Secrets unlock cards — we never hold your keys.",
  },
  {
    icon: <Sparkles size={16} className="text-rose-400" />,
    title: "Flexible splits & stocks",
    desc: "Deposit tokenized stocks (NVDA, AAPL, TSLA), ETH, or USDC and split into up to 50 equal cards — perfect for gifts, teams, and giveaways.",
  },
  {
    icon: <Zap size={16} className="text-amber-400" />,
    title: "Base-native speed",
    desc: "Low fees, fast settlement, and gas sponsorship — gifting that feels as easy as sending a link.",
  },
] as const;

export default function VoucherWhySection() {
  return (
    <SectionCard className="border border-[var(--border-subtle)]">
      <div className="flex items-center gap-2 mb-3">
        <Gift size={18} className="text-[var(--ink-muted)]" />
        <h3 className="text-lg sm:text-xl font-black text-[var(--ink)]">
          Why <span className="text-gradient-blue">Base Voucher</span>?
        </h3>
      </div>

      <p className="text-sm sm:text-base text-[var(--ink)] leading-relaxed mb-2">
        Base Voucher is a fully decentralized crypto and stock gift card protocol on{" "}
        <span className="text-[var(--brand)] font-bold">Base</span> — reinventing digital gifting so
        anyone, anywhere can create and redeem tangible onchain gift cards in tokenized stocks, ETH, or USDC.
      </p>
      <p className="text-sm text-[var(--ink-muted)] leading-relaxed mb-6">
        Powered by open smart contracts, it removes the friction of traditional gift cards and
        custodial platforms. You choose the asset (stocks or crypto), split it across cards, share a Card ID + secret,
        and recipients redeem straight to their wallet — with transparency, security, and global
        reach built in from day one.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {POINTS.map((p) => (
          <div
            key={p.title}
            className="glass-panel-accent rounded-xl p-4 flex items-start gap-3"
          >
            <div className="shrink-0 w-8 h-8 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center">
              {p.icon}
            </div>
            <div>
              <p className="text-sm font-black text-[var(--ink)]">{p.title}</p>
              <p className="text-[11px] text-[var(--ink-muted)] font-medium leading-snug mt-1">
                {p.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-[var(--ink-muted)] text-center mt-6 font-medium leading-relaxed">
        No accounts. No intermediaries. Just decentralized stock & crypto gift cards — for anyone, anywhere on Base.
      </p>
    </SectionCard>
  );
}
