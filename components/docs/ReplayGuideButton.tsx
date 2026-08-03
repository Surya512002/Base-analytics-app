"use client";

import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";
import { armGuideReplay } from "@/lib/utils/onboarding-tour";

/** Docs CTA — arms replay and returns home so the in-app guide can open. */
export default function ReplayGuideButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        armGuideReplay("main");
        router.push("/?tab=launchpad&guide=1");
      }}
      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] transition-colors"
    >
      <Compass size={16} className="text-[var(--brand)]" />
      Replay in-app guide
    </button>
  );
}
