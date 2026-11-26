"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  BadgeCheck,
  ExternalLink,
  Gift,
  Loader2,
  Lock,
  ReceiptText,
  Repeat,
  Share2,
  Sparkles,
  Wallet,
} from "lucide-react";
import GiftBox from "@/components/ui/motion/GiftBox";
import type { SenderIdentity } from "@/lib/voucher/campaign";

/** "loading": the gift is still being read from Base. */
export type GiftClaimStatus = "loading" | "ready" | "claiming" | "opened" | "unavailable";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;

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
        <span className="text-amber-200">{left.toLocaleString()}</span> of {total.toLocaleString()}{" "}
        {total === 1 ? "gift" : "gifts"} left
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
                  remaining ? "bg-white/20 text-amber-200 shadow-sm ring-1 ring-white/25" : "bg-white/5 text-white/40"
                }`}
              >
                {remaining ? "🎁" : "·"}
              </motion.span>
            );
          })}
        </div>
      ) : (
        <div className="h-2 w-56 overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-200 to-amber-400"
            initial={{ width: 0 }}
            animate={{ width: `${(left / total) * 100}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      )}
    </div>
  );
}

/** Counts the number in "$5.00" / "0.25 NVDAc" up from zero, keeping its prefix, suffix and decimals. */
function CountUp({ label }: { label: string }) {
  const reduce = useReducedMotion();
  const m = /^([^\d]*)([\d,]*\.?\d+)(.*)$/.exec(label);
  const target = m ? Number(m[2].replace(/,/g, "")) : NaN;
  const decimals = m && m[2].includes(".") ? m[2].split(".")[1].length : 0;
  const animate = Boolean(m) && Number.isFinite(target) && target > 0 && !reduce;
  const [value, setValue] = useState(animate ? 0 : target);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) return;
    const start = performance.now();
    const dur = 1100;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) ref.current = requestAnimationFrame(step);
    };
    // Wait for the card to land before counting.
    const delay = window.setTimeout(() => (ref.current = requestAnimationFrame(step)), 450);
    return () => {
      window.clearTimeout(delay);
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [animate, target]);

  if (!m || !animate) return <>{label}</>;
  const shown = value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <>
      {m[1]}
      {shown}
      {m[3]}
    </>
  );
}

const CONFETTI = ["#FDE68A", "#F59E0B", "#FFFFFF", "#ded0f9", "#A78BFA", "#34D399", "#F472B6"];

/** Confetti raining over the whole stage once, after the gift opens. */
function ConfettiRain({ count = 46 }: { count?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const left = (i * 37) % 100;
        const size = 6 + ((i * 7) % 6);
        const drift = ((i * 53) % 80) - 40;
        const delay = ((i * 13) % 30) / 100;
        const dur = 1.8 + ((i * 17) % 10) / 10;
        const round = i % 5 === 0;
        return (
          <motion.span
            key={i}
            className="absolute top-0"
            style={{
              left: `${left}%`,
              width: size,
              height: round ? size : size * 0.45,
              borderRadius: round ? 999 : 2,
              background: CONFETTI[i % CONFETTI.length],
            }}
            initial={{ y: -20, x: 0, opacity: 1, rotate: 0 }}
            animate={{ y: 620, x: drift, opacity: [1, 1, 0], rotate: (i % 2 ? 1 : -1) * 540 }}
            transition={{ duration: dur, delay, ease: [0.25, 0.6, 0.4, 1], times: [0, 0.8, 1] }}
          />
        );
      })}
    </div>
  );
}

/**
 * The claim moment for any gift (personal gift cards and one-link gifts).
 *
 * A blue stage with a gift box resting open a crack, the card peeking out. Tap the box or the
 * Claim button to send the claim transaction: the box wobbles while the wallet confirms. Once the
 * transaction is confirmed, the lid flies off, confetti falls and the gift card pops out of the
 * box with the amount counting up, the message, the sender and a receipt.
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
  kindLabel = "Gift on Base",
  claimLabel,
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
  /** Last claim error, shown right under the button. */
  error?: string;
  /** Small label at the top of the stage, e.g. "One-link gift". */
  kindLabel?: string;
  /** Button text when ready; defaults to "Claim {amount}". */
  claimLabel?: string;
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
  const claiming = status === "claiming";
  const loading = status === "loading";
  const canTap = status === "ready" && !locked;
  const senderName = sender?.basename || sender?.label || null;
  const verified = sender?.trust === "basename-verified";

  // A short buzz on phones when the gift opens.
  const [buzzed, setBuzzed] = useState(false);
  if (opened && !buzzed) setBuzzed(true);
  useEffect(() => {
    if (buzzed && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.([30, 40, 60]);
      } catch {
        /* not supported */
      }
    }
  }, [buzzed]);

  const tap = () => {
    if (canTap) onTap();
  };

  const buttonText = claiming
    ? statusText || "Confirm in your wallet…"
    : loading
      ? statusText || "Reading the gift from Base…"
    : locked
      ? `Opens in ${untilText(unlockAt!, now)}`
      : status === "unavailable"
        ? statusText || "This gift can't be claimed"
        : claimLabel || `Claim ${amountLabel}`;

  return (
    <div className="pulse-surface relative px-4 pb-6 pt-5 sm:px-8">
      {opened && <ConfettiRain />}

      {/* Top line: what it is + gifts left */}
      <div className="flex items-center justify-between gap-2">
        <span className="pulse-eyebrow inline-flex items-center gap-1.5">
          <Gift size={13} /> {kindLabel}
        </span>
        {senderName || sender ? (
          <span className="inline-flex min-w-0 items-center gap-1 truncate rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-bold ring-1 ring-white/20">
            from {senderName ?? short(sender!.address)}
            {verified && <BadgeCheck size={12} className="shrink-0 text-emerald-300" aria-label="Verified Basename" />}
          </span>
        ) : null}
      </div>

      {total != null && left != null && !opened && (
        <div className="mt-4">
          <GiftsLeft left={left} total={total} />
        </div>
      )}

      {/* The box */}
      <motion.div
        className={`relative flex flex-col items-center ${total != null && left != null ? "mt-9" : "mt-10"}`}
        animate={opened && !reduce ? { scale: 0.62, marginBottom: -70 } : { scale: 1, marginBottom: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: opened ? 0.25 : 0 }}
        style={{ originY: 0 }}
      >
        <GiftBox
          size={230}
          peek
          open={opened}
          wiggle={claiming}
          locked={locked && !opened}
          disabled={!canTap && !opened}
          cardLabel="GIFT"
          cardValue="For you"
          ariaLabel={opened ? "Gift opened" : `Tap to claim ${amountLabel}`}
          onOpen={tap}
          className="max-sm:scale-90"
        />
      </motion.div>

      {/* Before: hint, message teaser, the Claim button */}
      <AnimatePresence initial={false}>
        {!opened && (
          <motion.div
            key="claim"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12, transition: { duration: 0.2 } }}
            className="mx-auto flex max-w-sm flex-col items-center text-center"
          >
            <p className="text-sm font-bold text-white/85">
              {canTap ? "Tap the box ✨" : claiming ? "Opening your gift…" : locked ? "This gift is locked for now" : " "}
            </p>
            {message?.trim() && (
              <p className="mt-2 line-clamp-2 text-sm italic text-white/80">&ldquo;{message.trim()}&rdquo;</p>
            )}

            <motion.button
              type="button"
              onClick={tap}
              disabled={!canTap}
              aria-busy={claiming || undefined}
              whileHover={canTap && !reduce ? { scale: 1.02 } : undefined}
              whileTap={canTap && !reduce ? { scale: 0.97 } : undefined}
              className={`mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-5 text-base font-black transition ${
                canTap
                  ? "cursor-pointer bg-white text-[#4a2170] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.45)] hover:bg-amber-50"
                  : claiming
                    ? "cursor-wait bg-white/90 text-[#4a2170]"
                    : "cursor-not-allowed bg-white/15 text-white/80 ring-1 ring-white/20"
              }`}
            >
              {claiming || loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : locked ? (
                <Lock size={16} />
              ) : status === "unavailable" ? (
                <AlertTriangle size={16} className="text-amber-200" />
              ) : (
                <Gift size={18} />
              )}
              <span className={`text-balance leading-tight ${canTap || claiming ? "" : "text-sm"}`}>{buttonText}</span>
            </motion.button>

            {error && !claiming && (
              <p role="alert" className="mt-2 max-w-sm rounded-xl bg-red-500/20 px-3 py-2 text-xs font-semibold text-white ring-1 ring-red-300/40">
                {error}
              </p>
            )}
            <p className="mt-2 text-[11px] text-white/70">
              {claiming
                ? "The box opens as soon as Base confirms the transaction."
                  : `${amountLabel.charAt(0).toUpperCase()}${amountLabel.slice(1)} goes straight to your wallet${expiresAt ? ` · claim within ${untilText(expiresAt, now)}` : ""}`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* After: the card that pops out of the box */}
      <AnimatePresence>
        {opened && (
          <motion.div
            key="card"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -150, scale: 0.25, rotate: -12 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 150, damping: 15, delay: 0.45 }}
            className="relative z-10 mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-white p-5 text-[#2a1646] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)]"
          >
            {/* shine */}
            {!reduce && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-blue-100/80 to-transparent"
                initial={{ x: "-150%" }}
                animate={{ x: "400%" }}
                transition={{ duration: 1.4, delay: 1.2, ease: "easeInOut" }}
              />
            )}
            <div className="relative flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--brand)]">
                <Gift size={13} /> Gift unwrapped
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-200">
                <BadgeCheck size={12} /> Confirmed
              </span>
            </div>

            <p className="relative mt-3 bg-gradient-to-r from-[var(--brand)] to-[#8e5fc4] bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
              <CountUp label={amountLabel} />
            </p>
            <p className="relative text-xs font-semibold text-slate-500">is now in your wallet</p>

            {message?.trim() && (
              <blockquote className="relative mt-4 rounded-2xl bg-blue-50 p-3 text-sm italic leading-relaxed text-[#2a1646]">
                &ldquo;{message.trim()}&rdquo;
              </blockquote>
            )}

            <div className="relative mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">From</p>
                <p className="flex items-center gap-1 truncate font-black">
                  {senderName ?? (sender ? short(sender.address) : "A friend on Base")}
                  {verified && <BadgeCheck size={13} className="shrink-0 text-emerald-500" aria-label="Verified Basename" />}
                </p>
                {sender && senderName && <p className="font-mono text-[11px] text-slate-500">{short(sender.address)}</p>}
              </div>
              {claimer && (
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">To</p>
                  <p className="flex items-center gap-1 font-mono font-bold">
                    <Wallet size={12} /> {short(claimer)}
                  </p>
                </div>
              )}
            </div>

            {txHash && TX_RE.test(txHash) && (
              <div className="relative mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[11px] font-bold">
                <a href={`/receipt/${txHash}`} className="inline-flex items-center gap-1 text-[var(--brand)] hover:underline">
                  <ReceiptText size={12} /> Receipt
                </a>
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-[var(--brand)] hover:underline"
                >
                  View on Basescan <ExternalLink size={11} />
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* What next */}
      {opened && (onShare || onCreateOwn || onSwap) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 1.2 }}
          className="relative z-10 mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-2"
        >
          {onShare && (
            <button type="button" onClick={onShare} className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full bg-white px-4 text-xs font-black text-[#4a2170] shadow-sm transition hover:bg-amber-50">
              <Share2 size={14} /> Share the love
            </button>
          )}
          {onCreateOwn && (
            <button type="button" onClick={onCreateOwn} className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full bg-white/15 px-4 text-xs font-bold text-white ring-1 ring-white/30 transition hover:bg-white/25">
              <Sparkles size={14} /> Send a gift back
            </button>
          )}
          {onSwap && (
            <button type="button" onClick={onSwap} className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full bg-white/15 px-4 text-xs font-bold text-white ring-1 ring-white/30 transition hover:bg-white/25">
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
