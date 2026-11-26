"use client";

import { motion, useReducedMotion } from "motion/react";
import { ExternalLink, Gift, Link2, ShieldCheck, Ticket } from "lucide-react";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";
import GiftBox from "@/components/ui/motion/GiftBox";
import ClickSpark from "@/components/ui/motion/ClickSpark";
import RotatingWords from "@/components/ui/motion/RotatingWords";
import { GlassChip, PulseEyebrow } from "@/components/ui/pulse";
import type { VoucherView } from "@/components/voucher/voucher-types";

const OCCASIONS = ["birthday", "thank-you", "team bonus", "holiday", "first stock"];

/**
 * Voucher section hero: big animated gift box + one clear headline and three actions.
 * Purely presentational — every button just switches the existing voucher view.
 */
export default function VoucherGiftHero({
  view,
  onNavigate,
}: {
  view: VoucherView;
  onNavigate: (v: VoucherView) => void;
}) {
  const reduce = useReducedMotion();
  const basescan = VOUCHER_CONTRACT ? `https://basescan.org/address/${VOUCHER_CONTRACT}` : "https://basescan.org";
  const enter = (d: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.5, delay: d, ease: [0.21, 0.47, 0.32, 0.98] as const },
        };

  return (
    <section
      aria-label="Gift on Base"
      className="pulse-surface"
    >
      <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10 lg:p-10">
        <div className="order-2 space-y-5 lg:order-1">
          <motion.div {...enter(0)}>
            <PulseEyebrow as="span">Gifts on Base</PulseEyebrow>
          </motion.div>

          <motion.h1
            {...enter(0.06)}
            className="text-3xl font-black leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl"
          >
            Send a{" "}
            <RotatingWords words={OCCASIONS} className="shiny-text" />
            <br />
            gift in one link.
          </motion.h1>

          <motion.p {...enter(0.12)} className="max-w-md text-sm leading-relaxed text-[var(--ink-muted)] sm:text-base">
            Wrap USDC, ETH or real tokenized stocks into a gift. Share a link — they open it and it lands in their
            wallet. Unclaimed gifts come back to you.
          </motion.p>

          <motion.div {...enter(0.18)} className="flex flex-wrap gap-2.5">
            <ClickSpark>
              <button
                type="button"
                onClick={() => onNavigate("create")}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-[#4a2170] shadow-lg shadow-black/15 transition hover:bg-white/90 active:scale-[0.97]"
              >
                <Gift size={16} /> Create a gift
              </button>
            </ClickSpark>
            <ClickSpark color="#ded0f9">
              <button
                type="button"
                onClick={() => onNavigate("campaign")}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/25 bg-white/15 px-5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/25 active:scale-[0.97]"
              >
                <Link2 size={16} className="text-[var(--brand-text)]" /> One link for many
              </button>
            </ClickSpark>
            <button
              type="button"
              onClick={() => onNavigate("redeem")}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 text-sm font-bold text-[var(--ink-muted)] transition hover:text-white"
            >
              <Ticket size={16} /> Got a gift? Claim it
            </button>
          </motion.div>

          <motion.div {...enter(0.24)} className="flex flex-wrap items-center gap-2">
            <GlassChip icon={<span className="pulse-status-dot" aria-hidden />}>Base mainnet</GlassChip>
            <GlassChip icon={<ShieldCheck size={12} aria-hidden />}>Non-custodial escrow</GlassChip>
            <a
              href={basescan}
              target="_blank"
              rel="noopener noreferrer"
              className="pulse-chip transition hover:bg-white/25"
            >
              Verified contract <ExternalLink size={11} aria-hidden />
            </a>
          </motion.div>
        </div>

        <motion.div
          className="order-1 flex justify-center lg:order-2"
          initial={reduce ? false : { opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 160, damping: 18, delay: 0.1 }}
        >
          <div className="flex flex-col items-center gap-1">
            <GiftBox size={240} cardValue={view === "campaign" ? "1 link" : "For you"} className="max-sm:scale-90" />
            <span className="text-[11px] font-semibold text-[var(--ink-dim)]">Tap the box ✨</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
