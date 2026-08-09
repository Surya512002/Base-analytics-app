"use client";

import type { Transition, Variants } from "motion/react";

/** Shared Motion presets (motion.dev) — respect reduced motion at call sites. */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 28,
  mass: 0.85,
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 32,
  mass: 0.7,
};

export const easeOut: Transition = {
  duration: 0.45,
  ease: [0.22, 1, 0.36, 1],
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: easeOut },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.35 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: springSoft },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: easeOut },
};

export const tabPanel: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(2px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -6,
    filter: "blur(2px)",
    transition: { duration: 0.2 },
  },
};

export type SectionAccent =
  | "explore"
  | "swap"
  | "vouchers"
  | "analytics"
  | "rewards"
  | "badges"
  | "default";

export const SECTION_THEME: Record<
  SectionAccent,
  {
    accent: string;
    soft: string;
    border: string;
    chip: string;
    bar: string;
    glow: string;
  }
> = {
  explore: {
    accent: "#059669",
    soft: "rgba(16,185,129,0.1)",
    border: "rgba(16,185,129,0.28)",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    bar: "from-emerald-500 via-teal-400 to-cyan-400",
    glow: "from-emerald-50/90 via-[var(--surface)] to-teal-50/40",
  },
  swap: {
    accent: "#4f46e5",
    soft: "rgba(99,102,241,0.1)",
    border: "rgba(99,102,241,0.28)",
    chip: "bg-indigo-50 text-indigo-800 border-indigo-200",
    bar: "from-indigo-500 via-violet-400 to-blue-400",
    glow: "from-indigo-50/90 via-[var(--surface)] to-violet-50/40",
  },
  vouchers: {
    accent: "#e11d48",
    soft: "rgba(244,63,94,0.1)",
    border: "rgba(244,63,94,0.28)",
    chip: "bg-rose-50 text-rose-800 border-rose-200",
    bar: "from-rose-500 via-pink-400 to-orange-300",
    glow: "from-rose-50/90 via-[var(--surface)] to-pink-50/40",
  },
  analytics: {
    accent: "#2563eb",
    soft: "rgba(37,99,235,0.1)",
    border: "rgba(37,99,235,0.28)",
    chip: "bg-sky-50 text-sky-900 border-sky-200",
    bar: "from-sky-500 via-blue-500 to-cyan-400",
    glow: "from-sky-50/90 via-[var(--surface)] to-blue-50/40",
  },
  rewards: {
    accent: "#ea580c",
    soft: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.3)",
    chip: "bg-orange-50 text-orange-900 border-orange-200",
    bar: "from-orange-500 via-amber-400 to-yellow-300",
    glow: "from-orange-50/90 via-[var(--surface)] to-amber-50/40",
  },
  badges: {
    accent: "#7c3aed",
    soft: "rgba(139,92,246,0.12)",
    border: "rgba(139,92,246,0.3)",
    chip: "bg-violet-50 text-violet-900 border-violet-200",
    bar: "from-violet-500 via-fuchsia-400 to-amber-300",
    glow: "from-violet-50/90 via-[var(--surface)] to-amber-50/30",
  },
  default: {
    accent: "#1a5cff",
    soft: "rgba(26,92,255,0.1)",
    border: "rgba(26,92,255,0.22)",
    chip: "bg-[var(--brand-soft)] text-[var(--brand-dark)] border-[var(--brand)]/25",
    bar: "from-[var(--brand)] to-[var(--teal)]",
    glow: "from-[var(--brand-soft)]/50 via-[var(--surface)] to-transparent",
  },
};

export function accentForTab(
  tab: string
): SectionAccent {
  if (tab === "launchpad") return "explore";
  if (tab === "swap") return "swap";
  if (tab === "basehub") return "vouchers";
  if (tab === "dashboard") return "analytics";
  if (tab === "checkin" || tab === "rewards") return "rewards";
  if (tab === "achievements") return "badges";
  return "default";
}
