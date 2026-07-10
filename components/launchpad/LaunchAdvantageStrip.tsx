"use client";

import { Sparkles, Zap } from "lucide-react";
import { LAUNCHPAD_ADVANTAGES } from "@/lib/launchpad/advantages";
import { BUILDER_CODE } from "@/lib/constants/env";

export default function LaunchAdvantageStrip() {
  return (
    <div className="rounded-2xl border border-[#0052FF]/25 bg-linear-to-r from-[#0052FF]/10 via-transparent to-emerald-500/10 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#6BA3FF]" />
          <p className="text-sm font-black text-white">Built to beat typical launchpads</p>
        </div>
        <p className="text-[10px] font-mono text-slate-500">
          Builder <span className="text-cyan-300">{BUILDER_CODE}</span> on every tx
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {LAUNCHPAD_ADVANTAGES.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
          >
            <p className="text-[11px] font-bold text-white flex items-center gap-1.5">
              <Zap size={11} className="text-emerald-400 shrink-0" />
              {item.title}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
