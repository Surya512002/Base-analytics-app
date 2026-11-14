"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Sparkles, Users } from "lucide-react";
import NumberTicker from "@/components/ui/motion/NumberTicker";
import { useUniqueUsers } from "@/hooks/useUniqueUsers";

const weekday = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });

/**
 * Community pulse: how many people used the app today (unique wallets, UTC day), how many of
 * them are brand new, the all-time total, and a 7-day bar chart. Live from Redis, refreshed
 * every minute.
 */
export default function CommunityPulse() {
  const reduce = useReducedMotion();
  // Read-only here: only the visitor's own connected wallet is ever recorded (in the app shell).
  const { count, today, newToday, last7, loading } = useUniqueUsers();
  const max = Math.max(1, ...last7.map((d) => d.users));
  const yesterday = last7.length >= 2 ? last7[last7.length - 2].users : 0;
  const delta = today - yesterday;

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl shadow-[var(--brand)]/20 sm:p-6"
      style={{ background: "linear-gradient(135deg, #0052FF 0%, #2F6BFF 45%, #6366F1 100%)" }}
    >
      {/* decorative glow + dots */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "16px 16px" }}
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-80" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            Community pulse · today
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-5xl font-black tabular-nums tracking-tight sm:text-6xl">
              {loading ? "…" : <NumberTicker value={today} />}
            </span>
            <span className="text-sm font-bold text-white/85">{today === 1 ? "person" : "people"} used Base Analytics</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
              <Sparkles size={12} /> {newToday} new today
            </span>
            {last7.length >= 2 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs yesterday
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
              <Users size={12} /> {count.toLocaleString()} all-time
            </span>
          </div>
        </div>

        {/* 7-day bars */}
        {last7.length > 0 && (
          <div className="flex h-28 items-end gap-1.5 sm:w-72" aria-label="Unique wallets per day, last 7 days">
            {last7.map((d, i) => {
              const isToday = i === last7.length - 1;
              const h = Math.max(6, Math.round((d.users / max) * 88));
              return (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.users} wallets`}>
                  <span className="font-mono text-[10px] font-bold text-white/80">{d.users}</span>
                  <motion.div
                    className={`w-full rounded-lg ${isToday ? "bg-white" : "bg-white/35"}`}
                    initial={reduce ? false : { height: 0 }}
                    animate={{ height: h }}
                    transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
                  />
                  <span className={`text-[10px] font-bold ${isToday ? "text-white" : "text-white/70"}`}>
                    {isToday ? "Today" : weekday(d.day)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="relative mt-4 text-[11px] text-white/70">
        Unique wallets that connected today (UTC), counted once each. Updates every minute.
      </p>
    </section>
  );
}
