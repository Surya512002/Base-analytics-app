"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import SparkleBurst from "./SparkleBurst";

/**
 * Big animated gift box (pure DOM + motion, no images). Floats gently, lifts its lid on hover,
 * and on click pops open: the lid flies up, a light beam and a gift card rise out, sparkles burst.
 * Closes again by itself. Fully static when the user prefers reduced motion.
 */
export default function GiftBox({
  size = 260,
  cardLabel = "GIFT",
  cardValue = "On Base",
  autoOpen = false,
  onOpen,
  className = "",
  open: openProp,
  wiggle = false,
  locked = false,
  disabled = false,
  ariaLabel = "Open the gift box",
}: {
  size?: number;
  cardLabel?: string;
  cardValue?: string;
  /** Open once shortly after mounting (e.g. on a claim page). */
  autoOpen?: boolean;
  onOpen?: () => void;
  className?: string;
  /**
   * Controlled mode (claim screens): the box stays shut until this is true and never closes by
   * itself. Clicking only calls onOpen, which should start the claim.
   */
  open?: boolean;
  /** Shake while something is in progress (e.g. waiting for the wallet). */
  wiggle?: boolean;
  /** Show a padlock on the box (gift not open yet). */
  locked?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const reduce = useReducedMotion();
  const [openState, setOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? Boolean(openProp) : openState;
  const [hover, setHover] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const closeTimer = useRef<number | null>(null);

  const pop = useCallback(() => {
    if (controlled) {
      onOpen?.();
      return;
    }
    setOpen(true);
    setBurstKey((k) => k + 1);
    onOpen?.();
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 2600);
  }, [onOpen, controlled]);

  // Controlled: burst once each time the box actually opens.
  const [prevOpen, setPrevOpen] = useState(open);
  if (controlled && prevOpen !== open) {
    setPrevOpen(open);
    if (open) setBurstKey((k) => k + 1);
  }

  useEffect(() => {
    if (!autoOpen || reduce) return;
    const t = window.setTimeout(pop, 700);
    return () => window.clearTimeout(t);
  }, [autoOpen, pop, reduce]);

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  }, []);

  const s = size / 260; // all measurements below are designed at 260px
  const px = (n: number) => n * s;

  // A claimed box throws its lid right off; the hero box just lifts it.
  const lidY = open ? -px(controlled ? 120 : 78) : hover && !disabled ? -px(10) : 0;
  const lidRotate = open ? (controlled ? -28 : -14) : hover && !disabled ? -3 : 0;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled && !wiggle && !(controlled && open)) pop();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`relative isolate select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded-3xl ${disabled ? "cursor-not-allowed" : "cursor-pointer"} ${className}`}
      style={{ width: size, height: size }}
    >
      {/* soft glow */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle at 50% 60%, rgba(0,82,255,0.45), rgba(99,102,241,0.18) 45%, transparent 70%)" }}
      />

      {/* twinkling stars around the box */}
      {!reduce &&
        [
          [8, 22, 0], [86, 14, 0.4], [92, 58, 0.9], [4, 64, 1.3], [48, 4, 1.7], [70, 88, 0.6], [22, 90, 1.1],
        ].map(([x, y, d], i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute -z-10 text-amber-200"
            style={{ left: `${x}%`, top: `${y}%`, fontSize: px(i % 2 ? 12 : 16) }}
            animate={{ opacity: [0.15, 1, 0.15], scale: [0.7, 1.15, 0.7] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: d, ease: "easeInOut" }}
          >
            ✦
          </motion.span>
        ))}

      <motion.div
        className="absolute inset-0"
        animate={
          reduce ? undefined : wiggle ? { rotate: [0, -4, 4, -3, 3, 0], y: 0 } : { y: [0, -px(8), 0], rotate: 0 }
        }
        transition={wiggle ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" } : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* light beam + rising card when open */}
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                key="beam"
                aria-hidden
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                  bottom: px(108),
                  width: px(150),
                  height: px(170),
                  background: "linear-gradient(to top, rgba(253,230,138,0.55), rgba(253,230,138,0))",
                  clipPath: "polygon(30% 100%, 70% 100%, 100% 0, 0 0)",
                }}
                initial={{ opacity: 0, scaleY: 0.2 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
              <motion.div
                key="card"
                className="absolute left-1/2 flex flex-col justify-between rounded-xl border border-white/30 text-left text-white shadow-2xl"
                style={{
                  width: px(128),
                  height: px(82),
                  marginLeft: -px(64),
                  bottom: px(120),
                  padding: px(10),
                  background: "linear-gradient(135deg, #0052FF 0%, #6366F1 100%)",
                }}
                initial={{ y: px(60), opacity: 0, rotate: 0 }}
                animate={{ y: -px(40), opacity: 1, rotate: -6 }}
                exit={{ y: px(60), opacity: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.12 }}
              >
                <span className="font-black tracking-[0.2em]" style={{ fontSize: px(9) }}>{cardLabel}</span>
                <span className="font-black leading-none" style={{ fontSize: px(cardValue.length > 9 ? 13 : 17) }}>
                  {cardValue}
                </span>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* box body */}
        <div
          className="absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-[18%] shadow-[0_30px_60px_-20px_rgba(0,82,255,0.6)]"
          style={{
            bottom: px(20),
            width: px(190),
            height: px(130),
            background: "linear-gradient(160deg, #2F6BFF 0%, #0052FF 45%, #1E3A8A 100%)",
          }}
        >
          <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.18), transparent 40%)" }} />
          {/* vertical ribbon */}
          <div
            aria-hidden
            className="absolute inset-y-0 left-1/2 -translate-x-1/2"
            style={{ width: px(28), background: "linear-gradient(90deg, #FDE68A, #F59E0B 50%, #FDE68A)" }}
          />
          {/* base wordmark */}
          <div
            aria-hidden
            className="absolute bottom-[10%] left-[10%] font-black uppercase text-white/70"
            style={{ fontSize: px(10), letterSpacing: "0.18em" }}
          >
            Base
          </div>
          {locked && (
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#1E3A8A] shadow-lg"
              style={{ width: px(46), height: px(46), fontSize: px(22) }}
            >
              🔒
            </div>
          )}
        </div>

        {/* lid + bow */}
        <motion.div
          className="absolute left-1/2"
          style={{ bottom: px(140), width: px(212), marginLeft: -px(106), height: px(44), originX: 0.15, originY: 1 }}
          animate={{ y: lidY, rotate: lidRotate }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-[14px] shadow-lg"
            style={{ background: "linear-gradient(160deg, #4C82FF 0%, #1D4ED8 100%)" }}
          >
            <div
              aria-hidden
              className="absolute inset-y-0 left-1/2 -translate-x-1/2"
              style={{ width: px(28), background: "linear-gradient(90deg, #FDE68A, #F59E0B 50%, #FDE68A)" }}
            />
            <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.25), transparent 60%)" }} />
          </div>
          {/* bow */}
          <div aria-hidden className="absolute left-1/2 -translate-x-1/2" style={{ bottom: px(38), width: px(110), height: px(52) }}>
            <div
              className="absolute rounded-[50%_50%_10%_50%] border-4 border-amber-300"
              style={{ left: px(6), top: px(8), width: px(48), height: px(38), transform: "rotate(-24deg)", background: "linear-gradient(135deg,#FDE68A,#F59E0B)" }}
            />
            <div
              className="absolute rounded-[50%_50%_50%_10%] border-4 border-amber-300"
              style={{ right: px(6), top: px(8), width: px(48), height: px(38), transform: "rotate(24deg)", background: "linear-gradient(225deg,#FDE68A,#F59E0B)" }}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full bg-amber-400 ring-2 ring-amber-200"
              style={{ bottom: px(2), width: px(22), height: px(22) }}
            />
          </div>
        </motion.div>
      </motion.div>

      {burstKey > 0 && !reduce && <SparkleBurst key={burstKey} />}
    </button>
  );
}
