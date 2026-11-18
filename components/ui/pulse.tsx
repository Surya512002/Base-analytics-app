"use client";

/**
 * Pulse design primitives — the visual language of the Community Pulse card, shared app-wide.
 * Styles live in app/globals.css (".pulse-*" classes and "--pulse-*" tokens). These are
 * purely presentational: no data, no effects beyond entrance motion.
 *
 *   <PulseSurface>            vivid blue→violet gradient with dot grid + glow
 *   <PulseEyebrow live>       small uppercase label with a glowing status dot
 *   <BigStat value caption>   huge bold number with a lighter inline caption
 *   <GlassChip icon>          frosted pill chip
 *   <MiniBars data>           rounded translucent bar chart, current bar solid
 */

import React, { type ElementType, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

type Polymorphic = { as?: ElementType; className?: string; children?: ReactNode };

export function PulseSurface({
  as: Tag = "section",
  className = "",
  children,
  ...rest
}: Polymorphic & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Tag className={`pulse-surface ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** Stand-alone dot grid overlay; place inside a `relative` parent. */
export function DotGrid({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`pulse-dots absolute inset-0 ${className}`} />;
}

export function StatusDot({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`pulse-status-dot ${className}`} />;
}

export function PulseEyebrow({
  children,
  live = true,
  className = "",
  as: Tag = "p",
}: {
  children: ReactNode;
  live?: boolean;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Tag className={`pulse-eyebrow ${className}`}>
      {live && <StatusDot />}
      {children}
    </Tag>
  );
}

export function BigStat({
  value,
  caption,
  size = "lg",
  className = "",
}: {
  value: ReactNode;
  caption?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const num = size === "lg" ? "text-5xl sm:text-6xl" : size === "md" ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl";
  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      <span className={`pulse-big ${num}`}>{value}</span>
      {caption && <span className="text-sm font-bold text-[var(--ink-muted)]">{caption}</span>}
    </div>
  );
}

export function GlassChip({
  icon,
  children,
  tone = "glass",
  className = "",
  title,
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "glass" | "muted" | "up";
  className?: string;
  title?: string;
}) {
  const toneCls = tone === "muted" ? "pulse-chip-muted" : tone === "up" ? "pulse-chip-up" : "";
  return (
    <span className={`pulse-chip ${toneCls} ${className}`} title={title}>
      {icon}
      {children}
    </span>
  );
}

export interface MiniBar {
  key: string;
  label: ReactNode;
  value: number;
  /** Shown above the bar; defaults to the value. */
  display?: ReactNode;
  title?: string;
  current?: boolean;
}

export function MiniBars({
  data,
  ariaLabel,
  height = 88,
  className = "",
}: {
  data: MiniBar[];
  ariaLabel: string;
  height?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={`flex items-end gap-1.5 ${className}`} role="img" aria-label={ariaLabel}>
      {data.map((d, i) => {
        const h = Math.max(6, Math.round((d.value / max) * height));
        return (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-1" title={d.title}>
            <span className="font-mono text-[11px] font-bold text-[var(--ink-muted)]">{d.display ?? d.value}</span>
            <motion.div
              className="w-full rounded-lg"
              style={{ background: d.current ? "#ffffff" : "var(--pulse-bar)" }}
              initial={reduce ? false : { height: 0 }}
              animate={{ height: h }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
            />
            <span className={`text-[11px] font-bold ${d.current ? "text-[var(--ink)]" : "text-[var(--ink-dim)]"}`}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
