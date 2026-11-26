"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BadgeCheck, CalendarClock, Clock, Crown, ExternalLink, Lock, Repeat, Ticket, Users } from "lucide-react";
import { GlassChip, PulseEyebrow } from "@/components/ui/pulse";
import { resolveBasenameClient } from "@/lib/utils/resolve-basename";
import { DROPS_EXPLORER } from "@/lib/drops/network";
import AirdropScene from "./AirdropScene";
import { untilText } from "./ui";

export type DropState = "closed" | "ended" | "empty" | "paused" | "soon" | "live";

const STATE_CHIP: Record<DropState, { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-emerald-400/25 text-emerald-50 border-emerald-300/40" },
  soon: { label: "Opens soon", cls: "bg-sky-400/25 text-sky-50 border-sky-300/40" },
  paused: { label: "Paused", cls: "bg-amber-400/25 text-amber-50 border-amber-300/40" },
  empty: { label: "All claimed", cls: "bg-white/15 text-white border-white/25" },
  ended: { label: "Ended", cls: "bg-white/15 text-white border-white/25" },
  closed: { label: "Closed", cls: "bg-red-400/25 text-red-50 border-red-300/40" },
};

/**
 * Top of the claim page, in the voucher hero style: a crate parachuting in, the amount, the
 * sender (Basename when the creator's wallet has one), status, and how much is left.
 */
export default function ClaimHero({
  id,
  amount,
  message,
  senderLabel,
  creator,
  state,
  claimed,
  total,
  escrow,
  expiresAt,
  unlockAt,
  now,
  rules,
  liveNote,
  day,
}: {
  /** Replaces "for you to claim" while live (e.g. "between 0.001 and 0.02 ETH"). */
  liveNote?: string;
  /** 1-based day of the drop, shown for multi-day drops. */
  day?: number;
  id: string;
  amount: string;
  message: string;
  senderLabel: string;
  creator: string;
  state: DropState;
  claimed: number;
  total: number | null;
  escrow: string;
  expiresAt: number;
  unlockAt: number;
  now: number;
  rules: { perWallet: number; cooldownH: number; perDay: number; locked: boolean; codes: boolean; holders: boolean; list: boolean };
}) {
  const reduce = useReducedMotion();
  const [basename, setBasename] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    resolveBasenameClient(creator)
      .then((n) => alive && setBasename(n))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [creator]);

  const label = senderLabel.trim();
  const verified = Boolean(basename) && (!label || label.toLowerCase() === basename!.toLowerCase());
  const pct = total ? Math.min(100, Math.round((claimed / total) * 100)) : null;
  const chip = STATE_CHIP[state];

  return (
    <section aria-label={`Drop ${id}`} className="pulse-surface pulse-solid">
      <div className="grid items-center gap-4 p-6 sm:grid-cols-[1.3fr_1fr] sm:p-8">
        <div className="order-2 space-y-4 sm:order-1">
          <div className="flex flex-wrap items-center gap-2">
            <PulseEyebrow as="span">Drop #{id}</PulseEyebrow>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-black ${chip.cls}`}>
              {state === "live" && <span className="pulse-status-dot" aria-hidden />}
              {chip.label}
            </span>
          </div>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl"
          >
            {amount}
            <span className="block text-base font-bold text-white/75 sm:text-lg">
              {state === "live" ? (liveNote ?? "for you to claim") : state === "soon" ? "opens soon" : state === "paused" ? "paused for now" : "per claim"}
            </span>
          </motion.h1>

          {message && <p className="max-w-md rounded-2xl bg-white/10 px-4 py-3 text-sm italic text-white/90">“{message}”</p>}

          <div className="flex flex-wrap items-center gap-2 text-sm text-white/85">
            <span className="text-white/60">from</span>
            {basename || label ? (
              <span className="inline-flex items-center gap-1 font-black text-white">
                {verified ? basename : label}
                {verified ? (
                  <BadgeCheck size={15} className="text-emerald-300" aria-label="Verified Basename of this wallet" />
                ) : (
                  <span className="text-[11px] font-semibold text-amber-200">(name not verified)</span>
                )}
              </span>
            ) : null}
            <a href={`${DROPS_EXPLORER}/address/${creator}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-white/75 underline-offset-2 hover:underline">
              {creator.slice(0, 6)}…{creator.slice(-4)} <ExternalLink size={11} />
            </a>
          </div>

          {pct !== null && (
            <div className="max-w-md space-y-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-white/15">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-white"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <p className="text-[11px] font-semibold text-white/70">
                {claimed} of {total} claimed · {escrow} left in escrow
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {state === "soon" && <GlassChip icon={<Clock size={12} aria-hidden />}>Opens in {untilText(unlockAt, now)}</GlassChip>}
            {day && day > 0 && state === "live" && rules.cooldownH > 0 && <GlassChip icon={<CalendarClock size={12} aria-hidden />}>Day {day}</GlassChip>}
            {expiresAt > now && <GlassChip icon={<CalendarClock size={12} aria-hidden />}>Ends in {untilText(expiresAt, now)}</GlassChip>}
            {rules.perWallet > 0 && <GlassChip icon={<Users size={12} aria-hidden />}>{rules.perWallet === 1 ? "Once per wallet" : `${rules.perWallet} per wallet`}</GlassChip>}
            {rules.cooldownH > 0 && <GlassChip icon={<Repeat size={12} aria-hidden />}>{rules.cooldownH === 24 ? "Daily" : `Every ${rules.cooldownH}h`}</GlassChip>}
            {rules.perDay > 0 && <GlassChip>{rules.perDay}/day max</GlassChip>}
            {rules.codes && <GlassChip icon={<Ticket size={12} aria-hidden />}>Gift card</GlassChip>}
            {rules.holders && <GlassChip icon={<Crown size={12} aria-hidden />}>Holders only</GlassChip>}
            {rules.list && <GlassChip>List only</GlassChip>}
            {rules.locked && <GlassChip icon={<Lock size={12} aria-hidden />}>Locked by creator</GlassChip>}
          </div>
        </div>
        <div className="order-1 flex justify-center sm:order-2">
          <AirdropScene size={210} label={state === "live" || state === "soon" ? "FOR YOU" : undefined} />
        </div>
      </div>
    </section>
  );
}

/** Celebration after a successful claim. */
export function ClaimedBurst({ amount, explorerTx }: { amount: string; explorerTx?: string }) {
  const reduce = useReducedMotion();
  const dots = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
      {!reduce &&
        dots.map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
            style={{ background: ["#34d399", "#fde68a", "#82ACFF", "#f472b6"][i % 4] }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos((i / dots.length) * Math.PI * 2) * 140, y: Math.sin((i / dots.length) * Math.PI * 2) * 70, opacity: 0, scale: 0.4 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        ))}
      <motion.div initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
        <p className="text-3xl">🎉</p>
        <p className="mt-1 text-xl font-black text-[var(--ink)]">You claimed {amount}</p>
        <p className="text-sm text-[var(--ink-muted)]">It&apos;s in your wallet now.</p>
        {explorerTx && (
          <a className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-text)] underline" href={explorerTx} target="_blank" rel="noopener noreferrer">
            View transaction <ExternalLink size={11} />
          </a>
        )}
      </motion.div>
    </div>
  );
}
