"use client";

import type { Transition, Variants } from "motion/react";

/** Shared Motion presets — Refero-product polish; call sites respect reduced motion. */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 360,
  damping: 30,
  mass: 0.9,
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 34,
  mass: 0.72,
};

export const easeOut: Transition = {
  duration: 0.48,
  ease: [0.22, 1, 0.36, 1],
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: easeOut },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.38 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.965 },
  show: { opacity: 1, scale: 1, transition: springSoft },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: easeOut },
};

export const tabPanel: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: "blur(3px)",
    transition: { duration: 0.22 },
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
    accent: "#0d9f8c",
    soft: "rgba(13,159,140,0.1)",
    border: "rgba(13,159,140,0.28)",
    chip: "bg-teal-50 text-teal-900 border-teal-200",
    bar: "from-teal-500 via-emerald-400 to-cyan-400",
    glow: "from-teal-50/95 via-[var(--surface)] to-cyan-50/35",
  },
  swap: {
    accent: "#0284c7",
    soft: "rgba(14,165,233,0.1)",
    border: "rgba(14,165,233,0.28)",
    chip: "bg-sky-50 text-sky-900 border-sky-200",
    bar: "from-sky-500 via-blue-500 to-cyan-400",
    glow: "from-sky-50/95 via-[var(--surface)] to-blue-50/30",
  },
  vouchers: {
    accent: "#e11d48",
    soft: "rgba(244,63,94,0.09)",
    border: "rgba(244,63,94,0.26)",
    chip: "bg-rose-50 text-rose-900 border-rose-200",
    bar: "from-rose-500 via-orange-400 to-amber-300",
    glow: "from-rose-50/90 via-[var(--surface)] to-amber-50/30",
  },
  analytics: {
    accent: "#0b5fff",
    soft: "rgba(11,95,255,0.1)",
    border: "rgba(11,95,255,0.26)",
    chip: "bg-blue-50 text-blue-900 border-blue-200",
    bar: "from-blue-600 via-sky-500 to-teal-400",
    glow: "from-blue-50/95 via-[var(--surface)] to-sky-50/35",
  },
  rewards: {
    accent: "#ea580c",
    soft: "rgba(249,115,22,0.11)",
    border: "rgba(249,115,22,0.28)",
    chip: "bg-orange-50 text-orange-950 border-orange-200",
    bar: "from-orange-500 via-amber-400 to-yellow-300",
    glow: "from-orange-50/90 via-[var(--surface)] to-amber-50/30",
  },
  badges: {
    accent: "#0f766e",
    soft: "rgba(15,118,110,0.1)",
    border: "rgba(15,118,110,0.28)",
    chip: "bg-emerald-50 text-emerald-950 border-emerald-200",
    bar: "from-emerald-600 via-teal-500 to-cyan-400",
    glow: "from-emerald-50/90 via-[var(--surface)] to-teal-50/30",
  },
  default: {
    accent: "#0b5fff",
    soft: "rgba(11,95,255,0.09)",
    border: "rgba(11,95,255,0.22)",
    chip: "bg-[var(--brand-soft)] text-[var(--brand-dark)] border-[var(--brand)]/25",
    bar: "from-[var(--brand)] via-sky-500 to-[var(--teal)]",
    glow: "from-[var(--brand-soft)]/55 via-[var(--surface)] to-transparent",
  },
};

export function accentForTab(tab: string): SectionAccent {
  if (tab === "launchpad") return "explore";
  if (tab === "swap") return "swap";
  if (tab === "basehub") return "vouchers";
  if (tab === "dashboard") return "analytics";
  if (tab === "checkin" || tab === "rewards") return "rewards";
  if (tab === "achievements") return "badges";
  return "default";
}
