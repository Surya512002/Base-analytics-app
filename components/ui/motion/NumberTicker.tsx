"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * Counts up to `value` the first time it scrolls into view, then eases between later values.
 * Writes straight to the DOM (no re-render per frame). The final value is rendered on the
 * server, so there's no flash of "0" and screen readers always get the real number.
 */
export default function NumberTicker({
  value,
  format = (n) => n.toLocaleString(),
  className,
  duration = 0.9,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20px 0px" });
  const reduce = useReducedMotion();
  const from = useRef<number | null>(null);
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(value)) return;
    // Hidden tabs pause animation frames; never leave a half-counted (wrong) number on screen.
    const hidden = typeof document !== "undefined" && document.visibilityState !== "visible";
    if (reduce || !inView || hidden) {
      el.textContent = formatRef.current(value);
      if (inView) from.current = value;
      return;
    }
    const start = from.current ?? 0;
    from.current = value;
    if (start === value) {
      el.textContent = formatRef.current(value);
      return;
    }
    const controls = animate(start, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = formatRef.current(v);
      },
    });
    return () => controls.stop();
  }, [value, inView, reduce, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ""}`}>
      {Number.isFinite(value) ? format(value) : "—"}
    </span>
  );
}
