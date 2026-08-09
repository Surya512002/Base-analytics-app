"use client";

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type MotionProps,
} from "motion/react";
import type { ReactNode } from "react";
import type React from "react";
import {
  SECTION_THEME,
  fadeUp,
  scaleIn,
  staggerContainer,
  staggerItem,
  tabPanel,
  type SectionAccent,
} from "@/lib/motion/presets";

type DivProps = Omit<HTMLMotionProps<"div">, "children">;

export function MotionPage({
  children,
  pageKey,
  className = "",
}: {
  children: ReactNode;
  pageKey: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      key={pageKey}
      className={className}
      variants={tabPanel}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

export function MotionSection({
  children,
  className = "",
  delay = 0,
  accent,
  style,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  accent?: SectionAccent;
  style?: React.CSSProperties;
} & Omit<DivProps, "style" | "children">) {
  const reduce = useReducedMotion();
  const theme = accent ? SECTION_THEME[accent] : null;
  const mergedStyle: React.CSSProperties = {
    ...(theme
      ? {
          borderColor: theme.border,
          backgroundImage: `linear-gradient(160deg, ${theme.soft}, transparent 55%)`,
        }
      : {}),
    ...style,
  };

  if (reduce) {
    return (
      <div className={className} style={mergedStyle}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={mergedStyle}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-4% 0px" }}
      transition={{ delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function MotionStagger({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-2% 0px" }}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({
  children,
  className = "",
  hoverScale = 1.015,
}: {
  children: ReactNode;
  className?: string;
  hoverScale?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={staggerItem}
      whileHover={{ scale: hoverScale, y: -1 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
    >
      {children}
    </motion.div>
  );
}

export function MotionPop({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={scaleIn}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

export function MotionFloat({
  children,
  className = "",
  intensity = 6,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -intensity, 0] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

export function SectionAccentBar({
  accent = "default",
  className = "",
}: {
  accent?: SectionAccent;
  className?: string;
}) {
  const theme = SECTION_THEME[accent];
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`h-1 w-full bg-gradient-to-r ${theme.bar} ${className}`}
      aria-hidden
      initial={reduce ? false : { scaleX: 0, transformOrigin: "left" }}
      whileInView={reduce ? undefined : { scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}

export function AnimatedTabIndicator({ layoutId }: { layoutId: string }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <span className="absolute inset-0 rounded-xl bg-[var(--brand-soft)] border border-[var(--brand)]/25 -z-10" />
    );
  }
  return (
    <motion.span
      layoutId={layoutId}
      className="absolute inset-0 rounded-xl bg-[var(--brand-soft)] border border-[var(--brand)]/30 shadow-sm -z-10"
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
    />
  );
}

export type { MotionProps, SectionAccent };
