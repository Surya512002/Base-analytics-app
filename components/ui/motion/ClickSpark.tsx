"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";

type Spark = { id: number; x: number; y: number };

/**
 * Wraps any clickable element and draws a small burst of spark lines where the user presses.
 * Purely decorative (pointer-events-none overlay); the wrapped element's behaviour is untouched.
 */
export default function ClickSpark({
  children,
  color = "#FDE68A",
  className = "",
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [sparks, setSparks] = useState<Spark[]>([]);

  return (
    <span
      className={`relative inline-flex ${className}`}
      onPointerDown={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        const s = { id: Date.now() + Math.random(), x: e.clientX - r.left, y: e.clientY - r.top };
        setSparks((prev) => [...prev.slice(-3), s]);
        window.setTimeout(() => setSparks((prev) => prev.filter((p) => p.id !== s.id)), 600);
      }}
    >
      {children}
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
        <AnimatePresence>
          {sparks.map((s) =>
            Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return (
                <motion.span
                  key={`${s.id}-${i}`}
                  className="absolute block h-[2px] w-[10px] rounded-full"
                  style={{ left: s.x, top: s.y, background: color, rotate: `${(a * 180) / Math.PI}deg`, originX: 0 }}
                  initial={{ x: 0, y: 0, opacity: 1, scaleX: 1 }}
                  animate={{ x: Math.cos(a) * 22, y: Math.sin(a) * 22, opacity: 0, scaleX: 0.3 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                />
              );
            })
          )}
        </AnimatePresence>
      </span>
    </span>
  );
}
