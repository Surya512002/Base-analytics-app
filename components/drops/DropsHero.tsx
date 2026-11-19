"use client";

import React, { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ExternalLink, Gift, Link2, PackageOpen, ShieldCheck } from "lucide-react";
import ClickSpark from "@/components/ui/motion/ClickSpark";
import RotatingWords from "@/components/ui/motion/RotatingWords";
import { GlassChip, PulseEyebrow } from "@/components/ui/pulse";
import { DROPS_CONTRACT, parseDropLink } from "@/lib/drops/client";
import { DROPS_EXPLORER, IS_DROPS_TESTNET } from "@/lib/drops/network";
import AirdropScene from "./AirdropScene";

const AUDIENCES = ["community", "holders", "quest", "daily faucet", "raffle", "gift cards"];

/** Drops hero (same visual language as the voucher hero): headline, actions, airdrop animation. */
export default function DropsHero({
  view,
  onCreate,
  onMine,
  signedIn,
}: {
  view: "create" | "mine";
  onCreate: () => void;
  onMine: () => void;
  signedIn: boolean;
}) {
  const reduce = useReducedMotion();
  const [paste, setPaste] = useState("");
  const [pasteError, setPasteError] = useState("");
  const enter = (d: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.5, delay: d, ease: [0.21, 0.47, 0.32, 0.98] as const },
        };

  const openPasted = () => {
    try {
      const u = new URL(paste.trim());
      const parsed = parseDropLink(u.pathname, u.hash);
      if (!parsed.id) throw new Error();
      window.location.assign(`/drops/${parsed.id}${u.search}${u.hash}`);
    } catch {
      setPasteError("That doesn't look like a drop link.");
    }
  };

  return (
    <section aria-label="Drops on Base" className="pulse-surface">
      <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10 lg:p-10">
        <div className="order-2 space-y-5 lg:order-1">
          <motion.div {...enter(0)}>
            <PulseEyebrow as="span">Drops on Base</PulseEyebrow>
          </motion.div>
          <motion.h1 {...enter(0.06)} className="text-3xl font-black leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
            Airdrop to your <RotatingWords words={AUDIENCES} className="shiny-text" />
            <br />
            with your own rules.
          </motion.h1>
          <motion.p {...enter(0.12)} className="max-w-md text-sm leading-relaxed text-[var(--ink-muted)] sm:text-base">
            Pick who can claim, how often, and the tasks they finish first — follows, buys, quizzes, events. Funds sit in an
            onchain escrow until claimed, and anything left comes back to you.
          </motion.p>

          {signedIn && (
            <motion.div {...enter(0.18)} className="flex flex-wrap gap-2.5">
              <ClickSpark>
                <button
                  type="button"
                  onClick={onCreate}
                  aria-pressed={view === "create"}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-[#0041cc] shadow-lg shadow-black/15 transition hover:bg-white/90 active:scale-[0.97]"
                >
                  <Gift size={16} /> Create a drop
                </button>
              </ClickSpark>
              <ClickSpark color="#93C5FD">
                <button
                  type="button"
                  onClick={onMine}
                  aria-pressed={view === "mine"}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/25 bg-white/15 px-5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/25 active:scale-[0.97]"
                >
                  <PackageOpen size={16} /> My drops
                </button>
              </ClickSpark>
            </motion.div>
          )}

          <motion.form
            {...enter(0.22)}
            className="flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              openPasted();
            }}
          >
            <label className="sr-only" htmlFor="drop-paste">
              Paste a drop link
            </label>
            <input
              id="drop-paste"
              value={paste}
              onChange={(e) => {
                setPaste(e.target.value);
                setPasteError("");
              }}
              placeholder="Got a drop link? Paste it here"
              className="min-h-[44px] w-full rounded-full border border-white/25 bg-white/10 px-4 text-sm text-white placeholder:text-white/60 outline-none focus:border-white/60"
            />
            <button type="submit" className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-bold text-white hover:bg-white/25">
              <Link2 size={15} /> Open
            </button>
          </motion.form>
          {pasteError && <p className="text-xs font-semibold text-amber-200">{pasteError}</p>}

          <motion.div {...enter(0.26)} className="flex flex-wrap items-center gap-2">
            <GlassChip icon={<span className="pulse-status-dot" aria-hidden />}>{IS_DROPS_TESTNET ? "Base Sepolia (test)" : "Base mainnet"}</GlassChip>
            <GlassChip icon={<ShieldCheck size={12} aria-hidden />}>Non-custodial escrow</GlassChip>
            {DROPS_CONTRACT && (
              <a href={`${DROPS_EXPLORER}/address/${DROPS_CONTRACT}#code`} target="_blank" rel="noopener noreferrer" className="pulse-chip transition hover:bg-white/25">
                Verified contract <ExternalLink size={11} aria-hidden />
              </a>
            )}
          </motion.div>
        </div>

        <motion.div
          className="order-1 flex justify-center lg:order-2"
          initial={reduce ? false : { opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 160, damping: 18, delay: 0.1 }}
        >
          <div className="max-sm:-my-8 max-sm:scale-[0.78]">
            <AirdropScene size={250} label="DROP" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
