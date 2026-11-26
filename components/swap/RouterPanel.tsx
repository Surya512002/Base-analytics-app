"use client";

import { Check, Droplets, Layers, Sparkles, Waves, type LucideIcon } from "lucide-react";
import type { LaunchDex } from "@/lib/api/launchpad-client";
import { dexLabel, type SwapVenue } from "@/lib/launchpad/dex";

export const ROUTE_OPTIONS: { id: LaunchDex; label: string; note: string; icon: LucideIcon }[] = [
  { id: "auto", label: "Auto Best", note: "Picks the route for you", icon: Sparkles },
  { id: "aerodrome", label: "Aerodrome", note: "Classic pools", icon: Droplets },
  { id: "uniswap", label: "Uniswap", note: "Uniswap V3 pools", icon: Layers },
  { id: "slipstream", label: "Slipstream", note: "Aerodrome concentrated pools", icon: Waves },
];

/** Beside the swap card: choose which exchange to trade through, and see which one the quote uses. */
export default function RouterPanel({
  dex,
  onChange,
  activeDex,
}: {
  dex: LaunchDex;
  onChange: (dex: LaunchDex) => void;
  /** The venue behind the quote on screen, if there is one. */
  activeDex: SwapVenue | null;
}) {
  return (
    <section aria-labelledby="router-title" className="space-y-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <h2 id="router-title" className="px-1 text-[15px] font-bold text-[var(--ink)]">Router</h2>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        {ROUTE_OPTIONS.map(({ id, label, note, icon: Icon }) => {
          const on = dex === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(id)}
              className={`flex min-h-[60px] min-w-0 cursor-pointer items-center gap-2.5 rounded-2xl border p-2.5 text-left transition ${
                on
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--brand)]"
              }`}
            >
              <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${on ? "bg-white/20" : "bg-[var(--brand-soft)] text-[var(--brand-text)]"}`}>
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{label}</span>
                <span className={`block text-[13px] leading-snug ${on ? "text-white" : "text-[var(--ink-muted)]"}`}>{note}</span>
              </span>
              {on && <Check size={16} aria-hidden className="hidden shrink-0 sm:block" />}
            </button>
          );
        })}
      </div>
      <p role="status" className="px-1 text-[13px] text-[var(--ink-muted)]">
        {activeDex ? (
          <>
            This quote goes through <b className="text-[var(--ink)]">{dexLabel(activeDex)}</b>.
          </>
        ) : (
          "The route shows here once there is a quote."
        )}
      </p>
    </section>
  );
}
