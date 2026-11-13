"use client";

import { Gift, Link2, type LucideIcon } from "lucide-react";
import ActivePill from "@/components/ui/motion/ActivePill";

export type GiftKind = "personal" | "link";

const KINDS: Array<{ id: GiftKind; icon: LucideIcon; title: string; note: string; tag: string }> = [
  {
    id: "personal",
    icon: Gift,
    title: "Personal gift",
    note: "A gift card for one person, or a few, each with their own claim link.",
    tag: "Own link each",
  },
  {
    id: "link",
    icon: Link2,
    title: "One link for many",
    note: "Share a single link; the first people to open it claim an equal share.",
    tag: "First come, first served",
  },
];

/** First choice in Create: which kind of gift to make. Purely a switch between two flows. */
export default function GiftKindPicker({
  value,
  onChange,
}: {
  value: GiftKind;
  onChange: (kind: GiftKind) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Kind of gift" className="grid grid-cols-2 gap-2 sm:gap-3">
      {KINDS.map(({ id, icon: Icon, title, note, tag }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={`relative isolate flex cursor-pointer flex-col gap-2 rounded-2xl border p-3 text-left transition sm:flex-row sm:items-center sm:gap-3 sm:p-4 ${
              selected
                ? "border-[var(--brand)] text-white shadow-lg shadow-[var(--brand)]/25"
                : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--brand)]/50"
            }`}
          >
            {selected && <ActivePill layoutId="gift-kind-pill" className="bg-[var(--brand)]" />}
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                selected ? "bg-white/20 text-white" : "bg-[var(--brand-soft)] text-[var(--brand-text)]"
              }`}
            >
              <Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-black sm:text-base">{title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    selected ? "bg-white/20 text-white" : "bg-[var(--surface-2)] text-[var(--ink-muted)]"
                  }`}
                >
                  {tag}
                </span>
              </span>
              <span
                className={`mt-0.5 hidden text-xs leading-snug sm:block ${
                  selected ? "text-white/85" : "text-[var(--ink-muted)]"
                }`}
              >
                {note}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
