"use client";

import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { shortVanityAddress } from "@/lib/launchpad/vanity-salt";

export default function VanityAddressCard({
  address,
  attempts,
  grinding,
  onRefresh,
}: {
  address: string | null;
  attempts: number;
  grinding: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Vanity address</p>
          <p className="font-mono text-sm text-white truncate">
            {shortVanityAddress(address)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {grinding
              ? "Searching for a clean 0xB200… address…"
              : attempts > 0
                ? `Matched after ${attempts} attempts`
                : "All B20 tokens start with 0xB200…"}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={grinding}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold border border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-40"
      >
        {grinding ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        Refresh
      </button>
    </div>
  );
}
