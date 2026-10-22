"use client";

import { useState } from "react";
import Link from "next/link";
import { Rocket, X, ArrowRight } from "lucide-react";

export default function LaunchPromoBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-3 sm:px-4 sm:py-2.5 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand-soft)] text-xs font-medium text-[var(--ink)] animate-in fade-in duration-200 w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="p-1 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)] shrink-0">
          <Rocket size={14} />
        </span>
        <span className="truncate">
          Ready to launch your own token on Base? Instant liquidity &amp; 50% creator fee share.
        </span>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 w-full sm:w-auto">
        <Link
          href="/explore?create=true"
          className="pop-pill flex items-center justify-center gap-1 font-bold text-xs bg-[#0052FF] text-white px-3 py-1.5 rounded-lg hover:bg-[#0047e0] transition cursor-pointer flex-1 sm:flex-initial"
        >
          <span>Launch a token</span>
          <ArrowRight size={12} />
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 text-[var(--ink-muted)] hover:text-[var(--ink)] rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition shrink-0"
          aria-label="Dismiss banner"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
