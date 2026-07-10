import VoucherGiftCard3D from "@/components/wallet/VoucherGiftCard3D";
import AppLogo from "@/components/ui/AppLogo";
import { Gift, Sparkles, Zap } from "lucide-react";

const STATS = [
  { icon: <Gift size={13} />, label: "ETH & USDC" },
  { icon: <Zap size={13} />, label: "Gas sponsored" },
  { icon: <Sparkles size={13} />, label: "Up to 50 cards" },
] as const;

export default function VoucherHero() {
  return (
    <div className="spotlight-card voucher-hero-glow relative overflow-hidden">
      <div className="accent-bar" />

      <div className="relative grid lg:grid-cols-2 gap-8 lg:gap-10 p-6 sm:p-8 items-center">
        <div className="text-center lg:text-left tab-content-enter">
          <p className="section-eyebrow flex items-center justify-center lg:justify-start gap-2 mb-4">
            <span className="live-dot" />
            Base Voucher Protocol
          </p>

          <p className="page-hero-title leading-tight">Decentralized crypto gift cards</p>
          <p className="readable-body text-base sm:text-lg mt-3 max-w-md mx-auto lg:mx-0">
            Create, share, and redeem onchain gift cards on Base — from $1 USDC to full ETH batches.
            For anyone, anywhere.
          </p>

          <div className="mt-6 flex flex-wrap gap-2 justify-center lg:justify-start">
            {STATS.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1.5 editorial-badge text-[10px] font-bold"
              >
                <span className="text-white/50">{s.icon}</span>
                {s.label}
              </span>
            ))}
          </div>

          <div className="mt-5 inline-flex items-center gap-2.5 editorial-badge px-4 py-2.5">
            <AppLogo size="sm" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              Built on Base
            </span>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end py-4 lg:py-0 card-tilt-3d">
          <div className="animate-float">
            <VoucherGiftCard3D asset="USDC" showStack animated />
          </div>
        </div>
      </div>
    </div>
  );
}
