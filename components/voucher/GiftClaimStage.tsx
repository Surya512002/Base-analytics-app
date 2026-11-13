"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, BadgeCheck, ExternalLink, Gift, Lock, Repeat, Share2, Sparkles, Wallet } from "lucide-react";
import GiftBox from "@/components/ui/motion/GiftBox";
import type { SenderIdentity } from "@/lib/voucher/campaign";

export type GiftClaimStatus = "ready" | "claiming" | "opened" | "unavailable";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function untilText(sec: number, nowMs: number): string {
  const s = Math.max(0, Math.floor(sec - nowMs / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

/** "7 of 10 gifts left" with a row of little boxes (one per gift, or a bar when there are many). */
export function GiftsLeft({ left, total }: { left: number; total: number }) {
  const reduce = useReducedMotion();
  if (total <= 0) return null;
  const showBoxes = total <= 24;
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm font-black text-[var(--ink)]">
        <span className="text-[var(--brand-text)]">{left}</span> of {total} {total === 1 ? "gift" : "gifts"} left
      </p>
      {showBoxes ? (
        <div className="flex max-w-xs flex-wrap justify-center gap-1" aria-hidden>
          {Array.from({ length: total }, (_, i) => {
            const remaining = i < left;
            return (
              <motion.span
                key={i}
                initial={reduce ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.03, type: "spring", stiffness: 400, damping: 20 }}
                className={`flex h-5 w-5 items-center justify-center rounded-md text-[11px] ${
                  remaining ? "bg-[var(--brand)] text-amber-300 shadow-sm" : "bg-[var(--surface-2)] text-[var(--ink-dim)]"
                }`}
              >
                {remaining ? "🎁" : "·"}
              </motion.span>
            );
          })}
        </div>
      ) : (
        <div className="h-2 w-56 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <motion.div
            className="h-full rounded-full bg-[var(--brand)]"
            initial={{ width: 0 }}
            animate={{ width: `${(left / total) * 100}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The claim moment for any gift: a big gift box you tap. It wobbles while the wallet confirms,
 * then the lid flies off and the gift card rises out with the amount, the sender's message,
 * who sent it and where it landed. Used by both personal gift cards and one-link gifts.
 */
export default function GiftClaimStage({
  status,
  statusText,
  amountLabel,
  message,
  sender,
  left,
  total,
  unlockAt,
  expiresAt,
  claimer,
  txHash,
  error,
  onTap,
  onShare,
  onCreateOwn,
  onSwap,
}: {
  status: GiftClaimStatus;
  /** Busy text while claiming, or why the gift can't be claimed. */
  statusText?: string;
  amountLabel: string;
  message?: string;
  sender?: SenderIdentity | null;
  left?: number;
  total?: number;
  /** Unix seconds; 0 / undefined = none. */
  unlockAt?: number;
  expiresAt?: number;
  claimer?: string;
  txHash?: string;
  /** Last claim error, shown right under the box. */
  error?: string;
  onTap: () => void;
  onShare?: () => void;
  onCreateOwn?: () => void;
  onSwap?: () => void;
}) {
  const reduce = useReducedMotion();
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);

  const locked = Boolean(unlockAt && now && unlockAt * 1000 > now);
  const opened = status === "opened";
  const senderName = sender?.basename || sender?.label || null;
  const verified = sender?.trust === "basename-verified";

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-gradient-to-b from-[var(--brand-soft)] to-[var(--surface)] px-4 pb-6 transition-[padding] duration-500 sm:px-8 ${
        opened ? "pt-24" : "pt-5"
      }`}
    >
      {/* Gifts left */}
      {total != null && left != null && !opened && <GiftsLeft left={left} total={total} />}

      {/* The box */}
      <div className="mt-2 flex flex-col items-center">
        <GiftBox
          size={220}
          open={opened}
          wiggle={status === "claiming"}
          locked={locked && !opened}
          disabled={status === "unavailable" || locked}
          cardLabel="FOR YOU"
          cardValue={amountLabel}
          ariaLabel={opened ? "Gift opened" : `Tap to claim ${amountLabel}`}
          onOpen={onTap}
          className="max-sm:scale-90"
        />

        <AnimatePresence mode="wait">
          {!opened && (
            <motion.div
              key={status + (statusText ?? "") + String(locked)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-1 flex min-h-[44px] flex-col items-center text-center"
            >
              {status === "claiming" ? (
                <p className="inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-text)]">
                  <span className="h-2 w-2 animate-ping rounded-full bg-[var(--brand)]" />
                  {statusText || "Confirm in your wallet…"}
                </p>
              ) : locked ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink)]">
                  <Lock size={14} /> Opens in {untilText(unlockAt!, now)}
                </p>
              ) : status === "unavailable" ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-muted)]">
                  <AlertTriangle size={14} className="text-amber-500" /> {statusText || "This gift can't be claimed"}
                </p>
              ) : (
                <>
                  <p className="text-sm font-bold text-[var(--ink-muted)]">Tap the box ✨</p>
                  <p className="text-[11px] text-[var(--ink-dim)]">
                    {amountLabel} goes straight to your wallet{expiresAt ? ` · claim within ${untilText(expiresAt, now)}` : ""}
                  </p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {error && !opened && status !== "claiming" && (
          <p role="alert" className="mt-1 max-w-sm text-center text-xs font-semibold text-red-500">
            {error}
          </p>
        )}
      </div>

      {/* The card that comes out of the box */}
      <AnimatePresence>
        {opened && (
          <motion.div
            key="card"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -120, scale: 0.4, rotate: -8 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 140, damping: 16, delay: 0.35 }}
            className="relative mx-auto -mt-6 w-full max-w-md overflow-hidden rounded-3xl p-5 text-white shadow-2xl shadow-[var(--brand)]/30"
            style={{ background: "linear-gradient(135deg, #0052FF 0%, #3B6CFF 45%, #6366F1 100%)" }}
          >
            {/* shine */}
            {!reduce && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-white/20 blur-md"
                initial={{ x: "-150%" }}
                animate={{ x: "400%" }}
                transition={{ duration: 1.4, delay: 0.9, ease: "easeInOut" }}
              />
            )}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
                <Gift size={13} /> A gift for you
              </span>
              <Sparkles size={16} className="text-amber-300" />
            </div>

            <p className="mt-3 text-4xl font-black tracking-tight">{amountLabel}</p>
            <p className="text-xs font-semibold text-white/80">is now in your wallet</p>

            {message?.trim() && (
              <blockquote className="mt-4 rounded-2xl bg-white/12 p-3 text-sm italic leading-relaxed">
                &ldquo;{message.trim()}&rdquo;
              </blockquote>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">From</p>
                <p className="flex items-center gap-1 font-black">
                  {senderName ?? (sender ? short(sender.address) : "A friend on Base")}
                  {verified && <BadgeCheck size={13} className="text-emerald-300" aria-label="Verified Basename" />}
                </p>
                {sender && senderName && <p className="font-mono text-[11px] text-white/70">{short(sender.address)}</p>}
              </div>
              {claimer && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">To</p>
                  <p className="flex items-center gap-1 font-mono font-bold">
                    <Wallet size={12} /> {short(claimer)}
                  </p>
                </div>
              )}
            </div>

            {txHash && /^0x[a-fA-F0-9]{64}$/.test(txHash) && (
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-white/85 underline-offset-2 hover:underline"
              >
                Confirmed on Base · view transaction <ExternalLink size={11} />
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* What next */}
      {opened && (onShare || onCreateOwn || onSwap) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.9 }}
          className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-2"
        >
          {onShare && (
            <button type="button" onClick={onShare} className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full bg-[var(--brand)] px-4 text-xs font-black text-white shadow-sm transition hover:opacity-90">
              <Share2 size={14} /> Share the love
            </button>
          )}
          {onCreateOwn && (
            <button type="button" onClick={onCreateOwn} className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--ink)] transition hover:border-[var(--brand)]/50">
              <Gift size={14} /> Send a gift back
            </button>
          )}
          {onSwap && (
            <button type="button" onClick={onSwap} className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--ink)] transition hover:border-[var(--brand)]/50">
              <Repeat size={14} /> Swap it
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}

/** Opens an X post celebrating the gift (no personal data, just the amount and the app). */
export function shareGiftOnX(amountLabel: string) {
  const text = `I just unwrapped ${amountLabel} on Base 🎁 Send one to a friend:`;
  const url = typeof window !== "undefined" ? `${window.location.origin}/?tab=basehub` : "";
  window.open(
    `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    "_blank",
    "noopener,noreferrer"
  );
}
