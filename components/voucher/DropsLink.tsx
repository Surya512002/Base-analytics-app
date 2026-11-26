import Link from "next/link";
import { ChevronRight, ListChecks } from "lucide-react";
import { DROPS_CONTRACT } from "@/lib/drops/client";

/** Drops sit under Gifts, Send: a gift with rules. Marked "Coming soon" while no contract is set. */
export default function DropsLink() {
  return (
    <Link href="/drops" className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--brand)]">
      <ListChecks size={18} aria-hidden className="shrink-0 text-[var(--brand-text)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[var(--ink)]">
          Drops: gifts with rules and tasks
          {!DROPS_CONTRACT && <span className="ml-2 text-[13px] font-semibold text-[var(--ink-muted)]">Coming soon</span>}
        </span>
        <span className="block text-xs text-[var(--ink-muted)]">Daily claims, allowlists and tasks like follows or quizzes.</span>
      </span>
      <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--ink-dim)]" />
    </Link>
  );
}
