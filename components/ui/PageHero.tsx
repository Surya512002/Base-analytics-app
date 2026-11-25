"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { PulseEyebrow } from "@/components/ui/pulse";

export interface HeroAction {
  label: string;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
  icon?: ReactNode;
}

/**
 * Page hero in the Pulse language (see components/ui/pulse.tsx): a blue→violet gradient
 * surface with a dot grid, an uppercase eyebrow with a glowing status dot, a large white
 * headline, soft copy, white/glass pill buttons and frosted children (search, stat chips…).
 * Used at the top of Explore, Swap, Lend & Stake, Launch and Profile so they feel like one app.
 */
export default function PageHero({
  eyebrow,
  title,
  subtitle,
  actions = [],
  children,
  align = "center",
  size = "lg",
  as = "h1",
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: HeroAction[];
  /** Extra content under the buttons (search bar, stat pills…). */
  children?: ReactNode;
  align?: "center" | "left";
  size?: "lg" | "md" | "sm";
  /** Use "h2" on pages that already render their own (screen-reader) h1. */
  as?: "h1" | "h2";
}) {
  const reduce = useReducedMotion();
  const Heading = as === "h2" ? motion.h2 : motion.h1;
  const centered = align === "center";
  const enter = (d: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.5, delay: d, ease: [0.21, 0.47, 0.32, 0.98] as const },
        };

  return (
    <section
      className={`pulse-surface ${
        size === "lg" ? "px-5 py-7 sm:px-10 sm:py-12" : size === "md" ? "px-5 py-6 sm:px-8 sm:py-9" : "px-5 py-5 sm:px-7 sm:py-7"
      }`}
    >
      <div className={`flex flex-col ${size === "sm" ? "gap-3" : "gap-4 sm:gap-5"} ${centered ? "items-start text-left sm:items-center sm:text-center" : "items-start text-left"}`}>
        <motion.div {...enter(0)}>
          <PulseEyebrow as="span">{eyebrow}</PulseEyebrow>
        </motion.div>

        <Heading
          {...enter(0.05)}
          className={`max-w-3xl font-black tracking-tight text-white ${
            size === "lg"
              ? "text-4xl leading-[1.08] sm:text-5xl lg:text-6xl"
              : size === "md"
                ? "text-3xl leading-[1.1] sm:text-4xl"
                : "text-2xl leading-[1.15] sm:text-3xl lg:text-4xl"
          }`}
        >
          {title}
        </Heading>

        {subtitle && (
          <motion.p {...enter(0.1)} className={`max-w-xl leading-relaxed text-[var(--ink-muted)] ${size === "sm" ? "text-sm sm:text-base" : "text-base sm:text-lg"}`}>
            {subtitle}
          </motion.p>
        )}

        {actions.length > 0 && (
          <motion.div {...enter(0.15)} className={`flex w-full flex-wrap gap-3 sm:w-auto ${centered ? "sm:justify-center" : ""}`}>
            {actions.map((a) => {
              const cls = a.primary
                ? "bg-white text-[#0041cc] shadow-lg shadow-black/15 hover:bg-white/90"
                : "border border-white/25 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25";
              const inner = (
                <>
                  {a.icon}
                  {a.label}
                  <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </>
              );
              const base = `group inline-flex ${a.primary ? "max-sm:flex-1 max-sm:justify-center" : ""} ${size === "sm" ? "min-h-[40px] px-4 text-[13px]" : "min-h-[44px] px-5 text-sm"} items-center gap-2 rounded-full font-semibold transition active:scale-[0.97] ${cls}`;
              return a.href ? (
                <a key={a.label} href={a.href} className={base}>
                  {inner}
                </a>
              ) : (
                <button key={a.label} type="button" onClick={a.onClick} className={base}>
                  {inner}
                </button>
              );
            })}
          </motion.div>
        )}

        {children && (
          <motion.div {...enter(0.2)} className={`w-full ${centered ? "sm:flex sm:justify-center" : ""}`}>
            {children}
          </motion.div>
        )}
      </div>
    </section>
  );
}
