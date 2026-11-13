"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

export interface HeroAction {
  label: string;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
  icon?: ReactNode;
}

/**
 * Page hero in the Clario style, in our blue & white: an outlined eyebrow pill, one large
 * clean headline, a short line of copy, pill buttons with an arrow, and a soft blue glow.
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
  size?: "lg" | "md";
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
    <section className={`relative isolate ${size === "lg" ? "pt-6 pb-8 sm:pt-12 sm:pb-12" : "pt-4 pb-6 sm:pt-8 sm:pb-8"}`}>
      {/* soft blue glow */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -z-10 h-56 w-[min(42rem,100%)] rounded-full bg-[var(--brand)] opacity-[0.16] blur-3xl ${
          centered ? "left-1/2 top-1/3 -translate-x-1/2" : "left-0 top-1/4"
        }`}
      />
      <div className={`flex flex-col gap-4 sm:gap-5 ${centered ? "items-center text-center" : "items-start text-left"}`}>
        <motion.span
          {...enter(0)}
          className="inline-flex items-center rounded-full border border-[var(--brand)]/40 bg-[var(--brand-soft)] px-3.5 py-1 text-xs font-semibold text-[var(--brand-text)]"
        >
          {eyebrow}
        </motion.span>

        <Heading
          {...enter(0.05)}
          className={`max-w-3xl font-bold tracking-tight text-[var(--ink)] ${
            size === "lg" ? "text-4xl leading-[1.08] sm:text-5xl lg:text-6xl" : "text-3xl leading-[1.1] sm:text-4xl"
          }`}
        >
          {title}
        </Heading>

        {subtitle && (
          <motion.p {...enter(0.1)} className="max-w-xl text-base leading-relaxed text-[var(--ink-muted)] sm:text-lg">
            {subtitle}
          </motion.p>
        )}

        {actions.length > 0 && (
          <motion.div {...enter(0.15)} className={`flex flex-wrap gap-3 ${centered ? "justify-center" : ""}`}>
            {actions.map((a) => {
              const cls = a.primary
                ? "bg-[var(--brand)] text-white shadow-lg shadow-[var(--brand)]/30 hover:bg-[var(--brand-hover)]"
                : "border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand)]/50";
              const inner = (
                <>
                  {a.icon}
                  {a.label}
                  <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </>
              );
              const base = `group inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-sm font-semibold transition active:scale-[0.97] ${cls}`;
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
          <motion.div {...enter(0.2)} className={`w-full ${centered ? "flex justify-center" : ""}`}>
            {children}
          </motion.div>
        )}
      </div>
    </section>
  );
}

/** Small rounded stat pills shown under a hero (e.g. "Top APY 17.6%"). */
export function HeroStats({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div className="flex flex-wrap justify-center gap-2.5">
      {items.map((s) => (
        <div
          key={s.label}
          className="inline-flex items-baseline gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2 text-sm shadow-sm"
        >
          <span className="text-[var(--ink-muted)]">{s.label}</span>
          <span className="font-bold tabular-nums text-[var(--ink)]">{s.value}</span>
        </div>
      ))}
    </div>
  );
}
