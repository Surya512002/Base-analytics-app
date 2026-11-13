"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface WizardStepDef {
  step: number;
  title: string;
  hint: string;
  icon: LucideIcon;
}

/**
 * Step indicator: numbered/iconed dots joined by a track that fills as you advance.
 * Completed steps show a check; tapping a reachable step calls onSelect.
 */
export function WizardStepper({
  steps,
  current,
  onSelect,
  isDisabled,
}: {
  steps: WizardStepDef[];
  current: number;
  onSelect: (step: number) => void;
  isDisabled?: (step: number) => boolean;
}) {
  const reduce = useReducedMotion();
  const progress = (current - 1) / (steps.length - 1);

  return (
    <nav aria-label="Gift creation steps" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-4 sm:px-6 shadow-sm">
      <div className="relative">
        {/* track */}
        <div aria-hidden className="absolute left-5 right-5 top-5 h-1 rounded-full bg-[var(--surface-2)]" />
        <motion.div
          aria-hidden
          className="absolute left-5 top-5 h-1 rounded-full bg-gradient-to-r from-[var(--brand)] to-indigo-400"
          initial={false}
          animate={{ width: `calc((100% - 2.5rem) * ${progress})` }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 22 }}
        />
        <ol className="relative flex justify-between">
          {steps.map((s) => {
            const done = current > s.step;
            const active = current === s.step;
            const disabled = isDisabled?.(s.step) ?? false;
            const Icon = s.icon;
            return (
              <li key={s.step} className="flex flex-col items-center gap-1.5 text-center">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(s.step)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`Step ${s.step}: ${s.title}`}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed ${
                    active
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white shadow-lg shadow-[var(--brand)]/30"
                      : done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:border-[var(--brand)]/50"
                  }`}
                >
                  {active && !reduce && (
                    <motion.span
                      aria-hidden
                      className="absolute inset-0 rounded-full border-2 border-[var(--brand)]"
                      animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                  {done ? <Check size={18} strokeWidth={3} /> : <Icon size={17} />}
                </button>
                <span className={`text-[11px] font-bold sm:text-xs ${active ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}>
                  {s.title}
                </span>
                <span className="hidden max-w-[9rem] truncate text-[10px] text-[var(--ink-dim)] sm:block">{s.hint}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

/** Friendly header for each step: icon badge, title, one-line help. */
export function StepHeader({
  icon: Icon,
  step,
  total,
  title,
  description,
}: {
  icon: LucideIcon;
  step: number;
  total: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand)] to-indigo-500 text-white shadow-md shadow-[var(--brand)]/25">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-[var(--brand-text)]">
          Step {step} of {total}
        </p>
        <h2 className="text-xl font-black leading-tight text-[var(--ink)] sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">{description}</p>
      </div>
    </div>
  );
}

/** Slides step content in from the direction of travel. */
export function StepSlide({ direction, children }: { direction: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className="space-y-5">{children}</div>;
  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, x: direction * 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction * -28 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Visualises the split: a fan of mini gift cards (up to 6 drawn) with "N cards × amount each".
 * Re-animates when the count changes.
 */
export function SplitVisual({ count, perCard }: { count: number; perCard: string }) {
  const reduce = useReducedMotion();
  const drawn = Math.min(count, 6);
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4">
      <div className="relative h-14 shrink-0" style={{ width: 44 + (drawn - 1) * 10 }} aria-hidden>
        {Array.from({ length: drawn }, (_, i) => (
          <motion.div
            key={`${count}-${i}`}
            className="absolute top-0 h-14 w-11 rounded-lg border border-white/25 bg-gradient-to-br from-[var(--brand)] to-indigo-500 shadow-md"
            style={{ left: i * 10, zIndex: i }}
            initial={reduce ? false : { y: 12, opacity: 0, rotate: 0 }}
            animate={{ y: 0, opacity: 1, rotate: (i - (drawn - 1) / 2) * 5 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 20 }}
          >
            <span className="absolute left-1.5 top-1.5 h-1.5 w-4 rounded-full bg-white/50" />
            <span className="absolute bottom-1.5 left-1.5 text-[9px] font-black text-white">🎁</span>
          </motion.div>
        ))}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black text-[var(--ink)]">
          {count} {count === 1 ? "gift card" : "gift cards"}
          {count > 6 && <span className="font-semibold text-[var(--ink-muted)]"> (showing 6)</span>}
        </p>
        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold truncate">{perCard} each</p>
      </div>
    </div>
  );
}
