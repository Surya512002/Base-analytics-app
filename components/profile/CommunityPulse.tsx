"use client";

import React from "react";
import { Sparkles, Users } from "lucide-react";
import NumberTicker from "@/components/ui/motion/NumberTicker";
import { BigStat, GlassChip, MiniBars, PulseEyebrow, PulseSurface } from "@/components/ui/pulse";
import { useUniqueUsers } from "@/hooks/useUniqueUsers";

const weekday = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });

/**
 * Community pulse: how many people used the app today (unique wallets, UTC day), how many of
 * them are brand new, the all-time total, and a 7-day bar chart. Live from Redis, refreshed
 * every minute. Its look is the source of the app-wide Pulse design language
 * (components/ui/pulse.tsx).
 */
export default function CommunityPulse() {
  // Read-only here: only the visitor's own connected wallet is ever recorded (in the app shell).
  const { count, today, newToday, last7, loading } = useUniqueUsers();
  const yesterday = last7.length >= 2 ? last7[last7.length - 2].users : 0;
  const delta = today - yesterday;

  return (
    <PulseSurface className="p-5 sm:p-6">
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PulseEyebrow>Community pulse · today</PulseEyebrow>
          <BigStat
            className="mt-2"
            value={loading ? "…" : <NumberTicker value={today} />}
            caption={`${today === 1 ? "person" : "people"} used Base Analytics`}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <GlassChip icon={<Sparkles size={12} aria-hidden />}>{newToday} new today</GlassChip>
            {last7.length >= 2 && (
              <GlassChip>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs yesterday
              </GlassChip>
            )}
            <GlassChip icon={<Users size={12} aria-hidden />}>{count.toLocaleString()} all-time</GlassChip>
          </div>
        </div>

        {/* 7-day bars */}
        {last7.length > 0 && (
          <MiniBars
            className="h-28 sm:w-72"
            ariaLabel="Unique wallets per day, last 7 days"
            data={last7.map((d, i) => {
              const isToday = i === last7.length - 1;
              return {
                key: d.day,
                label: isToday ? "Today" : weekday(d.day),
                value: d.users,
                title: `${d.day}: ${d.users} wallets`,
                current: isToday,
              };
            })}
          />
        )}
      </div>

      <p className="relative mt-4 text-[11px] text-[var(--ink-dim)]">
        Unique wallets that connected today (UTC), counted once each. Updates every minute.
      </p>
    </PulseSurface>
  );
}
