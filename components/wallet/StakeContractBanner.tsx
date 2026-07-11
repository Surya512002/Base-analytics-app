"use client";

import { AlertCircle } from "lucide-react";
import { XP_STAKE_CONTRACT } from "@/lib/constants/env";

const isDev = process.env.NODE_ENV === "development";

export default function StakeContractBanner() {
  if (XP_STAKE_CONTRACT) return null;
  // Dev-only — never show env var instructions to live Base App users.
  if (!isDev) return null;

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 flex items-start gap-2">
      <AlertCircle size={16} className="text-amber-300 shrink-0 mt-0.5" />
      <p className="readable-body text-xs text-amber-100/90">
        On-chain XP staking is not configured in this environment. Local XP stake still works;
        set <code className="text-amber-200">NEXT_PUBLIC_XP_STAKE_CONTRACT</code> to enable
        on-chain stake.
      </p>
    </div>
  );
}
