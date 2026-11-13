"use client";

import { motion } from "motion/react";

/**
 * Sliding "selected" background for tabs / segmented controls. Render it inside the active
 * (position: relative) button; give every group its own `layoutId`. Motion animates it
 * between buttons; MotionConfig reducedMotion="user" turns that into an instant move.
 */
export default function ActivePill({ layoutId, className = "" }: { layoutId: string; className?: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden
      className={`absolute inset-0 -z-10 rounded-[inherit] ${className}`}
      transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.8 }}
    />
  );
}
