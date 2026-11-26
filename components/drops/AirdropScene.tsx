"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * The Drops hero art: a gift crate floats down from the sky on a parachute, swaying, lands with a
 * little bounce and a sparkle, then the next one drops. Clouds drift behind. Pure SVG + motion, no
 * images; a still scene when the visitor prefers reduced motion.
 */
export default function AirdropScene({ size = 260, label, still = false }: { size?: number; label?: string; /** Hover in place (no fall) for small spots. */ still?: boolean }) {
  const reduced = useReducedMotion();
  const reduce = reduced || still;
  const CYCLE = 6.5; // seconds per drop

  const fall = reduced
    ? { initial: false as const, animate: { y: 0 } }
    : still
      ? { initial: false as const, animate: { y: [0, -6, 0] }, transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const } }
    : {
        initial: { y: -170 },
        animate: { y: [-170, 0, -6, 0, 0] },
        transition: { duration: CYCLE, times: [0, 0.68, 0.74, 0.8, 1], ease: "easeInOut" as const, repeat: Infinity },
      };
  const sway = reduced
    ? {}
    : {
        animate: { rotate: [-7, 6, -4, 3, 0, 0] },
        transition: { duration: CYCLE, times: [0, 0.22, 0.44, 0.62, 0.72, 1], ease: "easeInOut" as const, repeat: Infinity },
      };
  // The canopy deflates once the crate touches down, then reappears for the next drop.
  const canopy = reduce
    ? {}
    : {
        animate: { scaleY: [1, 1, 0.35, 0.35, 1], opacity: [1, 1, 0, 0, 1] },
        transition: { duration: CYCLE, times: [0, 0.7, 0.82, 0.97, 1], repeat: Infinity },
      };
  const shadow = reduce
    ? {}
    : {
        animate: { scaleX: [0.25, 1, 1.15, 1, 0.25], opacity: [0.15, 0.55, 0.65, 0.55, 0.15] },
        transition: { duration: CYCLE, times: [0, 0.68, 0.74, 0.9, 1], repeat: Infinity },
      };
  const sparkle = reduce
    ? { animate: { opacity: 0 } }
    : {
        animate: { scale: [0, 0, 1.2, 0], opacity: [0, 0, 1, 0] },
        transition: { duration: CYCLE, times: [0, 0.69, 0.76, 0.9], repeat: Infinity },
      };

  return (
    <div className="relative select-none" style={{ width: size, height: size }} role="img" aria-label="A gift crate parachuting down">
      <svg viewBox="0 0 260 260" width={size} height={size} className="overflow-visible">
        <defs>
          <linearGradient id="drop-canopy" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#ded0f9" />
          </linearGradient>
          <linearGradient id="drop-crate" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#8e5fc4" />
            <stop offset="1" stopColor="#3d1b5e" />
          </linearGradient>
          <linearGradient id="drop-lid" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#c3a2f5" />
            <stop offset="1" stopColor="#8e5fc4" />
          </linearGradient>
          <radialGradient id="drop-glow">
            <stop offset="0" stopColor="#ded0f9" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ded0f9" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* sky glow + drifting clouds */}
        <circle cx="130" cy="120" r="115" fill="url(#drop-glow)" />
        {[
          { y: 46, w: 58, d: 0, dur: 18, o: 0.55 },
          { y: 92, w: 42, d: 6, dur: 22, o: 0.4 },
          { y: 150, w: 50, d: 11, dur: 20, o: 0.35 },
        ].map((c, i) => (
          <motion.g
            key={i}
            initial={{ x: reduce ? 40 + i * 60 : -80 }}
            animate={reduce ? undefined : { x: [-80, 300] }}
            transition={reduce ? undefined : { duration: c.dur, delay: c.d, repeat: Infinity, ease: "linear" }}
            opacity={c.o}
          >
            <ellipse cx="0" cy={c.y} rx={c.w / 2} ry="9" fill="#ffffff" />
            <ellipse cx={c.w * 0.18} cy={c.y - 7} rx={c.w / 3.4} ry="9" fill="#ffffff" />
          </motion.g>
        ))}

        {/* landing shadow */}
        <motion.ellipse cx="130" cy="236" rx="38" ry="6" fill="#0b1526" style={{ originX: "130px", originY: "236px" }} {...shadow} />

        {/* the falling group */}
        <motion.g {...fall}>
          <motion.g style={{ originX: "130px", originY: "70px" }} {...sway}>
            {/* canopy */}
            <motion.g style={{ originX: "130px", originY: "88px" }} {...canopy}>
              <path d="M70 88 C 72 40, 188 40, 190 88 Z" fill="url(#drop-canopy)" stroke="#dbe7ff" strokeWidth="1.5" />
              <path d="M70 88 Q 85 78 100 88 Q 115 78 130 88 Q 145 78 160 88 Q 175 78 190 88" fill="#e8f0ff" stroke="#ded0f9" strokeWidth="1.2" />
              <path d="M100 88 C 104 58, 118 48, 130 46" fill="none" stroke="#ded0f9" strokeWidth="1.2" />
              <path d="M160 88 C 156 58, 142 48, 130 46" fill="none" stroke="#ded0f9" strokeWidth="1.2" />
              {/* lines */}
              {[72, 100, 130, 160, 188].map((x) => (
                <line key={x} x1={x} y1="88" x2={x < 130 ? 116 : x > 130 ? 144 : 130} y2="168" stroke="#dbe7ff" strokeWidth="1.1" opacity="0.9" />
              ))}
            </motion.g>

            {/* crate */}
            <g transform="translate(130 186) scale(1.3) translate(-130 -186)">
              <rect x="104" y="166" width="52" height="44" rx="7" fill="url(#drop-crate)" />
              <rect x="100" y="158" width="60" height="14" rx="5" fill="url(#drop-lid)" />
              <rect x="126" y="158" width="8" height="52" fill="#fde68a" />
              <rect x="100" y="162" width="60" height="5" fill="#fcd34d" opacity="0.9" />
              <path d="M130 158 C 118 146, 108 150, 116 158 Z" fill="#fde68a" />
              <path d="M130 158 C 142 146, 152 150, 144 158 Z" fill="#fde68a" />
              <circle cx="130" cy="158" r="3.5" fill="#f59e0b" />
              {label && (
                <text x="130" y="197" textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffffff" fontFamily="inherit">
                  {label}
                </text>
              )}
            </g>
          </motion.g>
        </motion.g>

        {/* touchdown sparkle */}
        <motion.g style={{ originX: "130px", originY: "222px" }} {...sparkle}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line
              key={a}
              x1={130 + Math.cos((a * Math.PI) / 180) * 34}
              y1={222 + Math.sin((a * Math.PI) / 180) * 10}
              x2={130 + Math.cos((a * Math.PI) / 180) * 46}
              y2={222 + Math.sin((a * Math.PI) / 180) * 14}
              stroke="#fde68a"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ))}
        </motion.g>
      </svg>
    </div>
  );
}
