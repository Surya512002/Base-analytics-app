"use client";

import { motion, useReducedMotion } from "motion/react";
import AppLogo from "@/components/ui/AppLogo";

export default function LoadingScreen() {
  const reduce = useReducedMotion();

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center relative overflow-hidden">
      {!reduce && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {[
            { c: "rgba(11,95,255,0.16)", s: 200, x: "12%", y: "28%" },
            { c: "rgba(13,159,140,0.14)", s: 160, x: "72%", y: "52%" },
            { c: "rgba(14,165,233,0.12)", s: 130, x: "52%", y: "18%" },
          ].map((o, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full blur-3xl"
              style={{
                width: o.s,
                height: o.s,
                left: o.x,
                top: o.y,
                background: o.c,
              }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
              transition={{
                duration: 3.2 + i * 0.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}
      <motion.div
        className="text-center space-y-4 relative z-10"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <motion.div
          className="mx-auto w-fit"
          animate={
            reduce
              ? undefined
              : { rotate: [0, 3, -3, 0], scale: [1, 1.04, 1] }
          }
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <AppLogo size="xl" className="mx-auto" />
        </motion.div>
        <div>
          <p className="font-display text-[var(--ink)] font-semibold text-lg tracking-tight">
            BASE.ANALYTICS
          </p>
          <p className="text-[var(--ink-dim)] text-xs tracking-wide mt-1.5">
            Loading workspace…
          </p>
          {!reduce && (
            <div className="mt-4 mx-auto w-28 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[var(--brand)] via-[var(--sky)] to-[var(--teal)]"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: "55%" }}
              />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
