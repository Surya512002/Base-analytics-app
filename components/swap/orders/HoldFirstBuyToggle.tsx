"use client";

import { PLAN_RULES_ENABLED } from "@/lib/plans/hold-client";

/** Opt in to choosing rules before a new plan's first run. Hidden until plan rules are switched on. */
export default function HoldFirstBuyToggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  if (!PLAN_RULES_ENABLED) return null;
  return (
    <label className="flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 text-xs text-[var(--ink-muted)]">
      <input type="checkbox" className="mt-0.5" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <b className="text-[var(--ink)]">Let me set rules before the first run.</b> You sign one extra message (no gas). The first run waits until you save rules or choose none on each plan, for up to 30 minutes. Without this, the first run happens right away.
      </span>
    </label>
  );
}
