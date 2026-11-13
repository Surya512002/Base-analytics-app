"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

const COLORS = ["#FDE68A", "#F59E0B", "#60A5FA", "#0052FF", "#A78BFA", "#34D399", "#F472B6"];

/**
 * One-shot celebration burst: coloured confetti pieces and stars fly out from the centre of the
 * nearest positioned parent, then fall and fade. Remount (change `key`) to fire again.
 * Renders nothing when the user prefers reduced motion.
 */
export default function SparkleBurst({ count = 26, spread = 150 }: { count?: number; spread?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.2;
        const dist = spread * (0.55 + ((i * 37) % 45) / 100);
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * 0.85,
          color: COLORS[i % COLORS.length],
          star: i % 4 === 0,
          size: 6 + ((i * 13) % 7),
          spin: (i % 2 ? 1 : -1) * (180 + ((i * 29) % 180)),
          delay: (i % 5) * 0.02,
        };
      }),
    [count, spread]
  );
  if (reduce) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{
            width: p.star ? undefined : p.size,
            height: p.star ? undefined : p.size * 0.55,
            background: p.star ? undefined : p.color,
            color: p.color,
            borderRadius: 2,
            fontSize: p.star ? p.size + 6 : undefined,
            lineHeight: 1,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 60], opacity: [1, 1, 0], scale: 1, rotate: p.spin }}
          transition={{ duration: 1.3, delay: p.delay, ease: [0.16, 1, 0.3, 1], times: [0, 0.55, 1] }}
        >
          {p.star ? "✦" : null}
        </motion.span>
      ))}
    </div>
  );
}
