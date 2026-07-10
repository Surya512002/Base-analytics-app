"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, Megaphone, Rocket, Shield } from "lucide-react";
import { timeAgo } from "@/lib/launchpad/format";

type CalendarEvent = {
  id: string;
  type: "launch" | "vesting" | "anti-snipe" | "announcement";
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  at: number;
  label: string;
  detail?: string;
};

const ICONS = {
  launch: Rocket,
  vesting: Clock,
  "anti-snipe": Shield,
  announcement: Megaphone,
};

export default function LaunchCalendar({
  onOpenToken,
}: {
  onOpenToken?: (address: string) => void;
}) {
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/launchpad/calendar")
      .then((r) => r.json())
      .then((d) => setUpcoming(d.upcoming ?? []))
      .catch(() => setUpcoming([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-32 rounded-3xl border border-white/10 bg-white/[0.02] animate-pulse" />
    );
  }

  if (upcoming.length === 0) return null;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
        <Calendar size={16} className="text-amber-400" />
        <div>
          <h3 className="text-sm font-black text-white">Launch calendar</h3>
          <p className="text-[10px] text-slate-500">Vesting, anti-snipe & announcements</p>
        </div>
      </div>
      <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
        {upcoming.slice(0, 12).map((e) => {
          const Icon = ICONS[e.type];
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpenToken?.(e.tokenAddress)}
              className="w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-white/[0.03] transition-colors"
            >
              <div className="mt-0.5 w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                <Icon size={14} className="text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">
                  ${e.tokenSymbol} · {e.label}
                </p>
                {e.detail && (
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{e.detail}</p>
                )}
              </div>
              <span className="text-[10px] text-slate-500 shrink-0">{timeAgo(e.at)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
